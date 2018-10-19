import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import "./style.css";

var _ = require('file-loader?name=[name].[ext]!./index.html');
const buffer = require("buffer");
const scrypt = require("scrypt-js");
const index = require('ripple-keypairs');
const ripple_address = require('ripple-address-codec');
var BN = require('bn.js');
const $ = require('jquery');
const elliptic = require('elliptic');
const Secp256k1 = elliptic.ec('secp256k1');

const Decimal = require('decimal.js');
const RippleAPI = require('ripple-lib').RippleAPI;


const BigNumber = require("bignumber.js")
const assert = require('assert')


function base256decode(bytestr) {
    var value = new BN(0);
    for (var b in bytestr) {
        value = value.mul(new BN(256)).add(new BN(bytestr[b]));
    }
    return (value);
}

const api = new RippleAPI({
    server: 'wss://s2.ripple.com' // Public rippled server
});

var kp = {};

function recompute() {
    var secret1_b58 = $("#secret1").val();
    var secret2_b58 = $("#secret2").val();
    var N = 16384;
    var r = 8;
    var p = 8;
    var dkLen = 32;
    var enc = new TextEncoder();
    var secret1_b58_buff = enc.encode(secret1_b58);
    var secret2_b58_buff = enc.encode(secret2_b58);
    var salt = enc.encode("");
    var value = 0;

    try {
        ripple_address.decodeAccountID($("#address_solo").val());
    } catch (e) {
        myalert("#errorrecompute", "<strong>Error.</strong> This is not a valid Ripple Address");
        throw ("Address Invalid");
    }    

    scrypt(secret1_b58_buff, salt, N, r, p, dkLen, function(error, progress, key1) {
        if (error) {
            myalert("#errorrecompute", "<strong>Error.</strong>" + error);
        } else if (key1) {
            scrypt(secret2_b58_buff, salt, N, r, p, dkLen, function(error, progress, key2) {
                if (error) {
                    myalert("#errorrecompute", "<strong>Error.</strong>" + error);
                } else if (key2) {
                    var k1bn = base256decode(key1);
                    var k2bn = base256decode(key2);
                    var sumofkey = k1bn.add(k2bn);
                    var privatekeynum = sumofkey.mod(Secp256k1.n);
                    var pair = Secp256k1.keyFromPrivate(privatekeynum.toString(16), "hex");
                    //following line seems useless but it is not!
                    pair.getPublic();
                    var addr = index.deriveAddress(pair.pub.encode("hex", true));
                    if (addr != $("#address_solo").val()){
                        myalert("#errorrecompute", "<strong>Recompute Error.</strong>Check that you have entered the information correctly.");
                        throw("errorrecompute");
                    }
                    $("#publickey").val(pair.pub.encode("hex", true));
                    $("#privatekey").val(privatekeynum.toString(16));
                    $("#address").val(addr);

                    value = 100
                    $('#recomputeprogress').css('width', value + '%').attr('aria-valuenow', value);
                    $('#get_balance').prop('disabled', false);
                    kp = {
                        privateKey: privatekeynum.toString(16).toUpperCase(),
                        publicKey: pair.pub.encode("hex", true).toUpperCase()
                    };
                } else {
                    // update UI
                    value = parseInt(progress * 50 + 50);
                    $('#recomputeprogress').css('width', value + '%').attr('aria-valuenow', value);
                }
            });
        } else {
            // update UI
            value = parseInt(progress * 50);
            $('#recomputeprogress').css('width', value + '%').attr('aria-valuenow', value);
        }
    });
}

function getbalance() {
    api.connect().then(() => {
            console.log("connected");
            var a = api.getBalances($("#address").val(), {
                currency: "XRP"
            });
            var b = api.getFee();
            return Promise.all([a, b]);
        })
        .then(function([balance, currentfee]) {
            $("#xrpavail").val(balance[0].value + " XRP");
            $("#fee").val(currentfee + " XRP");
            if (balance[0].value > 20) {
                $('#send_xrp').prop('disabled', false);
            }
            else {
                throw ("Not enough XRP available (an XRP account cannot have less than 20 XRP)");
            }
        }).catch(function(e) {
            if (e.name === "RippledError") {
                myalert("#errorgetbalance", "<strong>RippledError.</strong>" + e.data.error_message);
            } else {
                myalert("#errorgetbalance", "<strong>Error.</strong>" + e);
            }
        });
}

function sendxrp() {
    console.log($("#amount").val())
    var amount_to_send = Decimal("0");
    var destination_address = $("#to").val();
    var source_address = $("#address").val();
    try {
        ripple_address.decodeAccountID(destination_address);
    } catch (e) {
        myalert("#errorsend", "<strong>Error.</strong>" + e);
        throw ("Address Destination Invalid");
    }
    var value = ""
    api.connect().then(() => {
            console.log("connected to ripple server");
            var a = api.getBalances(source_address, {
                currency: "XRP"
            });
            var b = api.getFee();
            return Promise.all([a, b]);
        })
        .then(function([balance, currentfee]) {
            var value = balance[0].value;
            amount_to_send = Decimal($("#amount").val());
            if (value - 20 < amount_to_send) {
                throw ("Not enough XRP available (an XRP account cannot have less than 20 XRP)");
            }
            var payment = {
                'source': {
                    'address': source_address,
                    'maxAmount': {
                        'value': amount_to_send.toString(),
                        'currency': 'XRP'
                    }
                },
                'destination': {
                    'address': destination_address,
                    'amount': {
                        'value': amount_to_send.toString(),
                        'currency': 'XRP'
                    }
                }
            };
            return api.preparePayment(source_address, payment, {
                fee: currentfee
            });
        })
        .then(prepared => {
            var signedTransaction = api.sign(prepared.txJSON, kp);
            return api.submit(signedTransaction.signedTransaction);
        })
        .then(result => {
            if (result.resultCode == "tesSUCCESS"){
                myalert("#successsend", "<strong>Success.</strong> The transfer to " + destination_address + " of " + amount_to_send.toString() + " XRP has been done and will be taken into account by the network in a few moments. Network message:" + result.resultMessage)
                $("#amount").val("");
                $("#to").val("");
            }
            else{
                throw( result.resultMessage);
            }

            return api.disconnect();
        })
        .catch(e => {
            myalert("#errorsend", "<strong>Error.</strong>" + e);
            console.error(e);
        });
}

function myalert(id, html) {
    var el = $(id)[0];
    el.innerHTML = html;
    el.style.display = 'block';
    el.scrollIntoView(true);
}

function cleanprivate() {
    $("#xrpavail").val("");
    $("#fee").val("");
    $("#amount").val("");
    $("#to").val("");
    $("#publickey").val("");
    $("#privatekey").val("");
    $("#address").val("");
    $('#get_balance').prop('disabled', true);
    $('#send_xrp').prop('disabled', true);
}

function remove_alerts() {
    $("#errorphishing")[0].style.display = 'none';
    $("#errorrecompute")[0].style.display = 'none';
    $("#successsend")[0].style.display = 'none';
    $("#errorgetbalance")[0].style.display = 'none';
    $("#errorsend")[0].style.display = 'none';
}

window.remove_alerts = remove_alerts
window.recompute = recompute;
window.getbalance = getbalance;
window.sendxrp = sendxrp;
window.cleanprivate = cleanprivate;

if (!window.location.href.startsWith("file:/")){
    myalert("#errorphishing", "<strong>Warning.</strong>. To avoid phishing attacks please run this website locally.");
}


