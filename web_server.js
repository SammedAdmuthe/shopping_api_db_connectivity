// import {applicationServer} from './application_server.js';
{/* <script type="text/javascript" src="application_server.js"></script> */}

// web server module, loaded using "require" -- waits for HTTP requests from clients
const http = require("http");

// NodeJS utilities for parsing and formatting URL query strings
const querystr = require('querystring');

// MySQL database driver
var sql = require("mysql");
const { Console } = require("console");

// web server listens on the environment port or 8000
const port = (process.env.PORT || 8000);

function initiateDBConnection() {
    //Create SQL connection logic
    var connection = sql.createConnection({
        host: "localhost",
        user: "root",
        password: "root123",
        database: "shopping"
    });
    return connection;
}
// const dBCon = mysql.createConnection({
//     host: "localhost",
//     user: "root",
//     password: "root123",
//     database: "shopping"
// });
// dBCon.connect(function(err) { if (err) throw err; });

// HTTP request part of the URI that routes the server actions
	//>> URI relates to "catalog" collection of products:
const regExpCatalog = new RegExp('^\/catalog.*');
	//>> URI relates to "orders" collection of purchase orders:
const regExpOrders = new RegExp('^\/orders\/.*','i');

const regExpProducts = new RegExp('^\/product.*');

const regExpCart = new RegExp('^\/cart.*');

// callback function, called by the web server to process client HTTP requests


function setHeader(resMsg){
    if (!resMsg.headers || resMsg.headers === null) {
        resMsg.headers = {};
      }
      if (!resMsg.headers["Content-Type"]) {
        resMsg.headers["Content-Type"] = "application/json";
      }

}
function addToCart(request, response, customerId, body) {
  let resMsg = {};
  var dBCon = initiateDBConnection();
  var body='';
  var catlog;
  var total_cost=0;
  var quantity_in_cart;
  var current_quantity = 1;
  var output = [];
  request.on('data', function(data){
    body+=data;
  });
  request.on("end", function() {     // process the request message body
  try {
    parsed = JSON.parse(body); // "product_id" is the primary key in "cart_item" table
    dBCon.connect(function (err){
      if (err) throw err; // throws error in case if connection is corrupted/disconnected
          // Find the current quantity of the given product id in the cart and increment by one
      dBCon.query("SELECT * from catalog where product_id=?", [parsed.product_id], function (err, result) {
        if (err) {
          resMsg.code = 503;
          resMsg.message = "Service Unavailable";
          resMsg.body = "MySQL server error: CODE = "
            + err.code + " SQL of the failed query: " + err.sql
            + " Textual description: " + err.sqlMessage;
        } 
        else {
          catalog = JSON.parse(JSON.stringify(result));
          dBCon.query("SELECT * from cart_item where cart_item_id=?", [parsed.product_id], function (err, result) {
            if (err) {
              resMsg.code = 503;
              resMsg.message = "Service Unavailable";
              resMsg.body = "MySQL server error: CODE = "
                  + err.code + " SQL of the failed query: " + err.sql
                  + " Textual description: " + err.sqlMessage;
            } else {
              quantity_in_cart = JSON.parse(JSON.stringify(result));
              if (quantity_in_cart[0] === undefined ||
                  quantity_in_cart[0].quantity === undefined) {
                total_cost =
                  catalog[0].price * (1 - (catalog[0].discount / 100));
              } else {
                total_cost = (quantity_in_cart[0].quantity + 1) *
                  catalog[0].price * (1 - (catalog[0].discount) / 100);
              }
            }
          });
          dBCon.query("INSERT into cart_item values(?,?,?,?,?,1) on DUPLICATE KEY update quantity = quantity + 1",
            [parsed.product_id, parsed.cart_id, parsed.product_id, total_cost,
              catalog[0].discount], function (err, result) {
            if (err) {
              resMsg.code = 503;
              resMsg.message = "Service Unavailable";
              resMsg.body = "MySQL server error: CODE = "
                + err.code + " SQL of the failed query: "+ err.sql
                + " Textual description : "+ err.sqlMessage;
            }
            // update total cost every time
            dBCon.query("UPDATE cart_item set price = ? where cart_item_id=?", [total_cost, parsed.product_id],
              function (err, result) {
                if (err) {
                  resMsg.code = 503;
                  resMsg.message = "Service Unavailable";
                  resMsg.body = "MySQL server error: CODE = "
                    + err.code + " SQL of the failed query: "
                + err.sql + " Textual description : " + err.sqlMessage;
                }
                dBCon.query("SELECT * from cart_item where cart_item_id=?", [parsed.product_id],
                  function (err, result_final) {
                    if(err) {  /* error 503 Service Unavailable */ }
                    resMsg.code = 200;
                    resMsg.message = "OK";
                    resMsg.body = JSON.stringify(result_final);
                    response.end(resMsg.body);
                });
            });
          });
      }
    });
    });
  } catch (ex) {
    resMsg.code = 500;
    resMsg.message = "Server Error";
  }
  return resMsg;
    });
}

function addProduct(request, response) {
  let resMsg = {};
  var dBCon = initiateDBConnection();
  var body='';
  request.on('data', function(data){
    body+=data;
  });

  request.on('end', function () {
    try{
      dBCon.connect(function (err) {
        newProduct = JSON.parse(body);
        sqlStatement = "INSERT INTO catalog(product_name, product_type, price) VALUES ('" + newProduct.name + "','"+ newProduct.type + "', " + newProduct.price+")";
        dBCon.query(sqlStatement, function (err, result) {
          if (err) {
            resMsg.code = 503;
            resMsg.message = "Service Unavailable";
            resMsg.body = "MySQL server error: CODE = " + err.code
                         + " SQL of the failed query: " + err.sql
                         + " Textual description: " + err.sqlMessage;
          }
          setHeader(resMsg);//Set Header
          response.writeHead(resMsg.code=200, resMsg.hdrs);
          resMsg.body = "Record inserted successfully"; 

          response.end(resMsg.body);
          dBCon.end();
        });
      });
    }
    catch (ex) {
      resMsg.code = 500;
      resMsg.message = "Server Error";
    }
  });


return resMsg;
  
}

function listProducts(request, response) {
    let resMsg = {}, sqlStatement;
    var filter;
    // detect any filter on the URL line, or just retrieve the full collection
    
    var dBCon = initiateDBConnection();
    
    dBCon.connect(function (err) {
        if (err) throw err; // throws error in case if connection is corrupted/disconnected

        query = request.url.split('?');
        if (query[1] !== undefined) {
          // parse URL query to a collection of <key, value> pairs:
          filters = query[1].split("=");
          //filters get split on "=" as product_id(Category) = 1 (Value)
          sqlStatement = "SELECT * FROM catalog WHERE " + filters[0]+"='"+filters[1]+"'";
        } else {
          sqlStatement = "SELECT * FROM catalog;";
        }

        dBCon.query(sqlStatement, function (err, result) {
            if (err) {
              resMsg.code = 503;
              resMsg.message = "Service Unavailable";
              resMsg.body = "MySQL server error: CODE = " + err.code
                    + " SQL of the failed query: " + err.sql
                    + " Textual description: " + err.sqlMessage;
            } else {
              resMsg.body =  JSON.stringify(JSON.parse(JSON.stringify(result))); // Step 1 : Convert databse result set into JSON String Step 2: Parse to actual JSON Step 3: finally convert JSON into JSON String
              setHeader(resMsg);//Set Header
              response.writeHead(resMsg.code=200, resMsg.hdrs),
              response.end(resMsg.body);
              dBCon.end();

            }
          });
    });
    
    return resMsg;
  }

function applicationServer(request, response) {
  let done = false, resMsg = {};
  
    // parse the URL in the request
  let urlParts = [];
  let segments = request.url.split('/');

  for (i=0, num=segments.length; i<num; i++) {
    if (segments[i] !== "") {  // check for trailing "/" or double "//"
      urlParts.push(segments[i]);
    }
  }
  console.log(urlParts);
  
  if(request.method == "GET"){
      // request processor for products "catalog" database collection
      try {
        if (regExpCatalog.test(request.url)) {
          resMsg = listProducts(request, response);
        //   resMsg = catalog(req, res, urlParts);
            done = true;
        }
      }
      catch(ex) { 
          
      }
  }
  else if(request.method == "POST"){
    //======================== Add Product =========================//
      try {
        if (regExpProducts.test(request.url)) {

          addProduct(request, response);
          done = true;
        }
      }
      catch(ex) { 
      }
  }
  else if(request.method == "PATCH"){
        //======================== Add To Cart =========================//
        try {
          if (regExpCart.test(request.url)) {
      
            addToCart(request, response);
            done = true;
          }
        }
        catch(ex) { 
         }
  }
  else if(request.method == "DELETE"){
    
  }
  if(done == false) {
    resMsg.code = 404;
    resMsg.body = "Not Found";
    setHeader(resMsg)
    response.writeHead(404, resMsg.hdrs),
    response.end(resMsg.body);
  }

}

// start the web server to wait for client HTTP requests
const webServer = http.createServer(applicationServer);
webServer.listen(port);
