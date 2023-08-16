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
              resMsg.message = "Service Unavailable";
              resMsg.body = "MySQL server error: CODE = "
                  + err.code + " SQL of the failed query: "
                  + err.sql + " Textual description : " + err.sqlMessage;
              response.status(503).send(resMsg);
            }
            response.set('content-type', 'application/json')
            response.status(200).send("Record inserted successfully");
            dBCon.end();
          });
        });
      }
      catch (ex) {
        response.status(500).send("Server Error");
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
            resMsg.message = "Service Unavailable";
            resMsg.body = "MySQL server error: CODE = "
              + err.code + " SQL of the failed query: "
              + err.sql + " Textual description : " + err.sqlMessage;
            response.status(503).send(resMsg);
          } 
          else {
            catalog = JSON.parse(JSON.stringify(result));
            dBCon.query("SELECT * from cart_item where cart_item_id=?", [parsed.product_id], function (err, result) {
              if (err) {
                resMsg.message = "Service Unavailable";
                resMsg.body = "MySQL server error: CODE = "
                  + err.code + " SQL of the failed query: "
                  + err.sql + " Textual description : " + err.sqlMessage;
                response.status(503).send(resMsg);
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
                resMsg.message = "Service Unavailable";
                resMsg.body = "MySQL server error: CODE = "
                  + err.code + " SQL of the failed query: "
                  + err.sql + " Textual description : " + err.sqlMessage;
                response.status(503).send(resMsg);
              }
              // update total cost every time
              dBCon.query("UPDATE cart_item set price = ? where cart_item_id=?", [total_cost, parsed.product_id],
                function (err, result) {
                  if (err) {
                    resMsg.message = "Service Unavailable";
                    resMsg.body = "MySQL server error: CODE = "
                      + err.code + " SQL of the failed query: "
                      + err.sql + " Textual description : " + err.sqlMessage;
                    response.status(503).send(resMsg);
                  }
                  dBCon.query("SELECT * from cart_item where cart_item_id=?", [parsed.product_id],
                    function (err, result_final) {
                      if(err) {  /* error 503 Service Unavailable */ }
                      var result_response = JSON.stringify(result_final);
                      response.set('content-type', 'application/json')
                      response.status(200).send(result_response);
                  });
              });
            });
        }
      });
      });
    } catch (ex) {
      response.status(500).send("Server Error");
    }
  });
}
function listProducts(request, response) {
    let resMsg = {}, sqlStatement;
    var filter;
    // detect any filter on the URL line, or just retrieve the full collection
    
    try{
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
                resMsg.message = "Service Unavailable";
                resMsg.body = "MySQL server error: CODE = "
                  + err.code + " SQL of the failed query: "
                  + err.sql + " Textual description : " + err.sqlMessage;
                response.status(503).send(resMsg);
              } else {
                // Step 1 : Convert databse result set into JSON String Step 2: Parse to actual JSON Step 3: finally convert JSON into JSON String
                var result_response = JSON.stringify(JSON.parse(JSON.stringify(result)));
                response.set('content-type', 'application/json')
                response.status(200).send(result_response);
                dBCon.end();
              }
            });
      });
    }
    catch(err) {
      response.status(200).send(result_response);
    }
    
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