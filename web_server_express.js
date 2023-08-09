var express = require('express');
var app = express();
var sql = require("mysql");

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
function setHeader(resMsg){
    if (!resMsg.headers || resMsg.headers === null) {
        resMsg.headers = {};
      }
      if (!resMsg.headers["Content-Type"]) {
        resMsg.headers["Content-Type"] = "application/json";
      }

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
    request.on("end", function() {
    try {
      parsed = JSON.parse(body); // "product_id" is the primary key in "cart_item" table
      dBCon.connect(function (err){
        if (err) throw err;
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
                console.log(err);
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
app.get('/catalog', function(req, res){

    listProducts(req, res);

});

app.post('/product', function(req, res){
    
    addProduct(req, res);

});

app.patch('/cart', function(req, res){
    
    addToCart(req, res);

});


app.listen(8009);