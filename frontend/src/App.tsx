import { TextField, Box, Button, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, StylesProvider, IconButton } from '@material-ui/core';
import { HttpTequilapiClient, IdentityRef, NodeHealthcheck, ServiceInfo, SessionStatsAggregatedResponse, TequilapiClient, TequilapiClientFactory, TequilapiError } from 'mysterium-vpn-js';
import { useEffect, useState } from 'react';
import { Refresh, PlayArrow, Stop } from '@material-ui/icons';
import './App.css';

interface nodeData {
  token: string,
  api: TequilapiClient,
  health: NodeHealthcheck,
  stats: SessionStatsAggregatedResponse,
  idenities: IdentityRef[],
  services: ServiceInfo[]
} 

function App() {
  const [nodes, setNodes] = useState<Map<string,nodeData>>(new Map())
  const [nodesKeys, setNodesKeys] = useState<string[]>([])
  const updateNode = (k: string, v: nodeData) => {
    setNodes(new Map(nodes.set(k,v)));
  }
  const removeNode = (k: string) => {
    nodes.delete(k)
    setNodes(new Map(nodes));
    setNodesKeys((oldArray) => oldArray.filter(x => x !== k))
  }

  // Retrieve data from local storage
  useEffect(() => {
    if(localStorage.getItem('nodes') && localStorage.getItem('nodesKeys')) {
      setNodes(new Map<string,nodeData>(JSON.parse(localStorage.getItem('nodes')!)))
      setNodesKeys(JSON.parse(localStorage.getItem('nodesKeys')!) as string[])
    }
  }, []);

  // Save node data to local storage
  useEffect(() => {
    // If none have API initialized call refreshAll
    if (nodesKeys.map(key => {
      if (nodes.has(key) && !(nodes.get(key)!.api instanceof HttpTequilapiClient))
        return false
      else
        return true
    }).every(x => x === false)) refreshAll()
    localStorage.setItem('nodes', JSON.stringify(Array.from(nodes.entries())));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, nodesKeys]);

  useEffect(() => {
    localStorage.setItem('nodesKeys', JSON.stringify(nodesKeys));
  }, [nodesKeys]);

  const [ipField, setIpField] = useState('')
  const [portField, setPortField] = useState('')
  const [passwordField, setPasswordField] = useState('')

  function addOrUpdateNode(ip: string, port: string, password?: string) {
    // Get data and save the result
    let address = ip + ':' + port
    getNodeData(ip, port, password).then(result => {
      if (password !== undefined) {
        // Reset fields
        setIpField('')
        setPortField('')
        setPasswordField('')
      }
      updateNode(address, result)
      let index = nodesKeys.indexOf(address)
      if (index === -1) {
        setNodesKeys(oldArray => [...oldArray, address])
      }
    }).catch((e: any) => {
      // Need to request token again but we don't store the password, so we need to re-add node
      if (e instanceof TequilapiError && e.isUnauthorizedError) {
        alert("Request unauthorized, you need to add your node again.")
        removeNode(address)
      } else {
        if (e.originalResponseData) alert(e.originalResponseData)
        else alert(e.message)
      }
    })
    
  }

  async function checkNodeAPI(nodeApi: TequilapiClient | null, ip: string, port: string, token: string): Promise<TequilapiClient> {
    // If it was retrived from localStorage and has no client we re-create it
    if (!(nodeApi instanceof HttpTequilapiClient)) {
      nodeApi = new TequilapiClientFactory('http://localhost:5000/proxy/' + ip + '/' + port + '/tequilapi').build()
      nodeApi.authSetToken(token)
    }
    return nodeApi
  }

  async function getNodeData(ip: string, port: string, password?: string) : Promise<nodeData> {
    let address = ip + ':' + port
    let nodeApi: TequilapiClient | null = null
    let token: string | null = null
    if (password === undefined) {
      // If no password we assume the token is already in the api and saved
      if (nodes.has(address)) {
        token = nodes.get(address)!.token
        nodeApi = await checkNodeAPI(nodes.get(address)!.api, ip, port, token)
      }
    } else {
      // Create node client
      nodeApi = new TequilapiClientFactory('http://localhost:5000/proxy/' + ip + '/' + port + '/tequilapi').build()
      // Retrieve token
      let response = await nodeApi.authAuthenticate({ username: "myst", password: password }, true)
      token = response.token
    }
    if (nodeApi != null && token != null) {
      let health = await nodeApi.healthCheck()
      let stats = await nodeApi.sessionStatsAggregated()
      let idenities = await nodeApi.identityList()
      let services = await nodeApi.serviceList()
      return {
        api: nodeApi,
        health: health,
        stats: stats,
        idenities: idenities,
        services: services,
        token: token
      }
    }
    throw Error("Something went wrong when calling the node API")
  }

  function refreshAll() {
    for (let nodeKey of nodesKeys) {
      let addressSplit = nodeKey.split(':')
      addOrUpdateNode(addressSplit[0], addressSplit[1])
    }
  }

  async function startNode(address: string) {
    if (nodes.has(address)) {
      let addressSplit = address.split(':')
      try {
        await nodes.get(address)!.api.serviceStart({
          providerId: nodes.get(address)!.idenities[0].id,
          type: "wireguard"
        })
        addOrUpdateNode(addressSplit[0], addressSplit[1])
      } catch (e) {
        // User doesn't have the updated status of the node, so we update it
        if (e instanceof TequilapiError && e.message.startsWith("Service already running")) {
          addOrUpdateNode(addressSplit[0], addressSplit[1])
        } else throw e
      }
    }
  }

  async function stopNode(address: string) {
    if (nodes.has(address)) {
      let addressSplit = address.split(':')
      try {
        await nodes.get(address)!.api.serviceStop(nodes.get(address)!.services[0].id)
        addOrUpdateNode(addressSplit[0], addressSplit[1])
      } catch (e) {
        // User doesn't have the updated status of the node, so we update it
        if (e instanceof TequilapiError && e.message.startsWith("Service not found")) {
          addOrUpdateNode(addressSplit[0], addressSplit[1])
        } else throw e
      }
    }
  }

  const nodesList = nodesKeys.map((key, i) => {
    if (nodes.has(key)) {
      let sumTokens = nodes.get(key)!.stats.stats.sumTokens/(10**18)
      let apiLoaded = nodes.get(key)!.api instanceof HttpTequilapiClient
      return  (
        <TableRow key={'row_'+i}>
          <TableCell component="th" scope="row">{key}</TableCell>
          {nodes.get(key)!.services.length > 0 ? <TableCell>{nodes.get(key)!.services[0].status}</TableCell> : <TableCell>Stopped</TableCell>}
          <TableCell>{nodes.get(key)!.health.uptime}</TableCell>
          <TableCell>{nodes.get(key)!.health.version}</TableCell>
          <TableCell>{nodes.get(key)!.stats.stats.count}</TableCell>
          <TableCell>{sumTokens.toFixed(2)}</TableCell>
          {apiLoaded ? (<TableCell>
            {nodes.get(key)!.services.length === 0 && <IconButton aria-label="start" onClick={() => startNode(key)}>
              <PlayArrow />
            </IconButton>}
            {nodes.get(key)!.services.length > 0 && <IconButton aria-label="stop" onClick={() => stopNode(key)}>
              <Stop />
            </IconButton>}
          </TableCell>) : (<TableCell>No API loaded</TableCell>)}
        </TableRow>)
    }
    else return <TableRow key={'row_'+i}></TableRow>
  })

  return (
    <StylesProvider injectFirst>
      <div style={{marginTop: '3em'}}>
        <Box display="flex" flexDirection="column" alignItems="center">
          <TextField type="text" label="IP" value={ipField} onChange={(event) => setIpField(event.target.value)}></TextField>
          <TextField type="number" label="Port" value={portField} onChange={(event) => setPortField(event.target.value)} style={{marginTop: '0.5em'}}></TextField>
          <TextField type="password" label="Password" value={passwordField} onChange={(event) => setPasswordField(event.target.value)} style={{marginTop: '0.5em'}}></TextField>
          <Button variant="contained" color="primary" onClick={() => addOrUpdateNode(ipField, portField, passwordField)} style={{marginTop: '2em'}}>Add Node</Button>
        </Box>
        <Box display="flex" flexDirection="column" alignItems="center">
          <TableContainer component={Paper} style={{marginLeft: "10%", marginRight: "10%", width: "auto", marginTop: '2em'}}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Address</TableCell>
                  <TableCell>Service status</TableCell>
                  <TableCell>Uptime</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Sessions</TableCell>
                  <TableCell>Total Earnings (MYSTT)</TableCell>
                  <TableCell>
                    {nodesList.length > 0 && <IconButton aria-label="refresh" onClick={refreshAll}>
                      <Refresh />
                    </IconButton>}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody >
                {nodesList}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </div>
    </StylesProvider>
  );
}

export default App;
