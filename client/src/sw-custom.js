let angularClient;
self.addEventListener('message', event => {
  console.log('hej hej hej', event)

  // if message is a "ping" string, 
  // we store the client sent the message into angularClient variable
  if (event.data == "ping") { 
    angularClient = event.source;  
    console.log({ angularClient })
  }
});