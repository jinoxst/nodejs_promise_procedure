var mysql = require('mysql');
var fs = require('fs');

var pool = mysql.createPool({
	host     : 'localhost', 
	database : 'foobar_db',
	user     : 'foobar_user',
	password : 'foobar_pw'
});

pool.on('connection', function(connection){
	connection.query('SET NAMES ' + config.db.charset);
});

function go(shop_code, goods_id, ticketCount){
	var tasks = [];
	var successCnt = 0;
	var failedCnt = 0;
	var idx = 0;
	pool.getConnection(function(err, conn){
		if(err){
			console.log(err);
		}else{
			conn.query('select ifnull(max(stocks_num),0) as stocks_num from stocks where goods_id=?',[goods_id], function(err, result){
				if(err){
					console.log(err.message);
				}else{
					var stocksNum = parseInt(result[0].stocks_num);
					console.log('stocksNum : ' + stocksNum);
					if(stocksNum < ticketCount){
						console.log('stocksNum is smaller than ' + ticketCount);
					}else{
						var workers = [];
						for(var i=0;i<ticketCount;i++){
							var fn = new Promise(function(resolve, reject){
								conn.query('call issueTicket(?,?)',[shop_code, goods_id], function(err, result){
									idx++;
									if(err){
										console.log(err.message);
									}else{
										console.log(idx + ', errorcode[' + result[0][0].errorcode + '], managecode:' + result[0][0].managecode + ', prepaidcode:' + result[0][0].prepaidcode);
										var code_str = result[0][0].managecode + ',' + result[0][0].prepaidcode;
										resolve(code_str);
										if(idx == ticketCount){
											pool.end(function (err) {				  
												if(err){
													console.log(err);
												}else{
													console.log('conn is closed');
												}
											});
										}
									}
								});
							});
							workers.push(fn);
						}
						Promise.all(workers).then(function(result){
							console.log(result);
							console.log('creating csv file');
							fs.writeFile(shop_code + '_' + goods_id + '.csv', result.join('\r\n'), function(err){
								if(err){
									console.log('creating csv file error');
								}else{
									console.log('creating csv file OK');
								}
							});
						}).catch(function(){
							console.log('worker error');
						});
					}
				}
			});
		}
	});
}

var shop_code = process.argv[2];
var goods_id = process.argv[3];
var ticketCount = process.argv[4];
if(shop_code && shop_code != 'undefined' && goods_id && goods_id != 'undefined' && ticketCount && ticketCount != 'undefined'){
	go(shop_code, goods_id, ticketCount);
}else{
	console.log('usage: node issueTicket.js shop_code goods_id ticketcount');
}