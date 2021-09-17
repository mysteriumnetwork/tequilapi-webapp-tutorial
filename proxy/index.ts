import { createServer, IncomingMessage, request, ServerResponse } from 'http';

createServer(onRequest).listen(5000);

function onRequest(req: IncomingMessage, res: ServerResponse) {
  let cors_headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'OPTIONS, POST, GET, PUT, DELETE',
    'Content-Type': '*/*',
    'Access-Control-Allow-Headers': '*'
  };

  if (req.method === 'OPTIONS') {
    // Pre-flight request. Reply successfully:
    res.writeHead(200, cors_headers);
    res.end();
    return;
  }

  let url = req.url?.split('/')
  //validity checks
  if (url!.length < 6) {
    res.write('url path too short');
    res.end();
    return
  }
  
  let target_ip = url![2]
  let target_port = url![3]
  let target_path = '/' + url!.slice(4).join('/')

  var options = {
    hostname: target_ip,
    port: target_port,
    path: target_path,
    method: req.method,
    headers: req.headers
  };
  
  var proxy = request(options, function (target_res: IncomingMessage) {
    res.writeHead(target_res.statusCode!, cors_headers);
    target_res.pipe(res, {
      end: true
    });
  });

  req.pipe(proxy, {
    end: true
  });

  proxy.on('error', function(err) {
    console.log("Request failed")
    res.writeHead(500, cors_headers);
    res.write("Request to node failed")
    res.end()
  });
}