# Mysterium node management app example

In this tutorial we are going to create a webapp that will allow us to manage and see stats of multiple nodes. We will use the [mysterium-vpn-js](https://github.com/mysteriumnetwork/mysterium-vpn-js) npm package to interact with our nodes and manage them.

Our webapp will consist in 2 parts:
- A react application
- A web proxy

We need to use a web proxy due to CORS limitations, if in the future we are able to set the CORS origin whitelist in our nodes, we will no longer need it. These limitations are set for security reasons.

To follow this tutorial you will need some requeriments:
- Node.js >= 14.0
- npm
- yarn

We will start by building the proxy as it provides a base for our webapp. We are going to use node.js with typescript to develop it.

## Proxy creation

1. Create a new directory called proxy where we are going to put the proxy code.

2. Run `yarn init` inside the proxy directory to start a new project, you can use the default values.

3. Install dependencies using `yarn add @types/node typescript` and `yarn add -D ts-node`.

4. Create the `tsconfig` file using `yarn tsc --init`.

5. Create a `index.ts` file.

6. We will start adding some code! We are just going to use default libraries. To create a proxy we will need a server which listens to the requests, forwards them, and forwards the reply back to us with the correct CORS headers. To create the server we will type:

```
import { createServer, IncomingMessage, request, ServerResponse } from 'http';

createServer(onRequest).listen(5000);

function onRequest(req: IncomingMessage, res: ServerResponse) {
  
}

```

7. Then we need to transform our call to the correct format. We will call the api using this url format: `http://localhost:5000/proxy/<ip>/<port>/tequilapi/<path>` and the proxy will transform it to `http://<ip>:<port>/tequilapi/<path>`. To do this transfomation we can use the following code:

```
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
```

We could add for validity checks to make sure that the url we are getting is correct, but for now we will keep it simple.

8. We now want to forward the request to our node, and then forward the response back as our api response but modifying some headers to overcome the CORS limitations. To do so we can use this code:

```
  let cors_headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'OPTIONS, POST, GET, PUT, DELETE',
    'Content-Type': '*/*',
    'Access-Control-Allow-Headers': '*'
  };

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
```

9. Finally, we will also need to answer to CORS preflight requests. A CORS preflight request is a CORS request that checks to see if the CORS protocol is understood and a server is aware using specific methods and headers.  
 For example, a client might be asking a server if it would allow a DELETE request, before sending a DELETE request, by using a preflight request. You can learn more about them using this [link](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request).  
 To answer them saying that everything is okay we should use this code at the start of the onRequest function:

```
  if (req.method === 'OPTIONS') {
    // Pre-flight request. Reply successfully:
    res.writeHead(200, cors_headers);
    res.end();
    return;
  }
```

We completed our proxy! You can run it by using `yarn ts-node ./index.ts` or by adding this:

```
"scripts": {
  "build": "tsc",
  "start": "node ./index.js",
  "dev": "ts-node ./index.ts"
}
```
to the root of `package.json` and using `yarn dev`.

## Webapp creation

1. We will start by going to the root of our project and running the create-react-app utility with the typescript option using `npx create-react-app --template typescript frontend`. This will create a new react project called frontend.

2. Now, to install our dependencies we will use:
 - `yarn add mysterium-vpn-js`: to install the mysterium-vpn-js npm package
 - `yarn add @material-ui/core`: for style so our webapp is not ugly.
 - `yarn add @material-ui/icons`: for the refresh, start and stop icons.

3. We will make a very simple webapp that will allow us to add nodes, see some stats and be able to turn the wireguard service on and off. To do so we will just modify the `App.tsx` file. We will start creating some variables to store our data. First we will create a list of all our nodes adresses, a map to store the data of each node and some helper functions to manipulate them:

```
  const [nodes, setNodes] = useState<Map<string,nodeData>>(new Map())
  const [nodesKeys, setNodesKeys] = useState<string[]>([])
  const updateNode = (k: string, v: nodeData) => {
    setNodes(new Map(nodes.set(k,v)));
  }
  const removeNode = (k: string) => {
    nodes.delete(k)
    setNodes(new Map(nodes));
    //TODO: remove node from list
  }
```