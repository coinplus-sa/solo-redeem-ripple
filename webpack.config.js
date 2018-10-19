const path = require('path');


const MiniCssExtractPlugin = require("mini-css-extract-plugin");
module.exports = {
    node: {
      net: 'empty',
      tls: 'empty',
      dns: 'empty'
    },
  entry: { main: './src/index.js' },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'coinplus_xrp_redeem.bundle.js'
  },
  resolve: {
    alias: {
        'node_modules': path.join(__dirname, 'node_modules')
    }
  }  
  ,optimization: {
// We no not want to minimize our code.
  },
   module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader"
        }
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              // you can specify a publicPath here
              // by default it use publicPath in webpackOptions.output
              publicPath: '../'
            }
          },
          "css-loader"
        ]
      },
      {
        test: /\.(png|jp(e*)g|svg)$/,  
        use: [{
            loader: 'url-loader',
            options: { 
                limit: 8000, // Convert images < 8kb to base64 strings
                name: 'img/[hash]-[name].[ext]'
            } 
        }]
      }

    ]
   },
  plugins: [
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: "style.css",
    })
  ],
};
