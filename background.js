chrome.runtime.onConnect.addListener(function(port) {
	port.onMessage.addListener(function(msg, sender) {
		console.log( msg, sender );
		if (msg.action === 'capture') {
			// Handle the message
			/*
			chrome.windows.getCurrent({ populate: false }, function(currentWindow) {
				if (chrome.runtime.lastError) {
					console.error(chrome.runtime.lastError);
					sender.postMessage({ action: 'capturederror', 'data': chrome.runtime.lastError.message });
					return;
				}
				
				chrome.tabs.captureVisibleTab(activeWindowId, { format: 'png' }, function(dataUrl) {
					if (chrome.runtime.lastError) {
						console.error(chrome.runtime.lastError);
						sender.postMessage({ action: 'capturederror', 'data': chrome.runtime.lastError.message });
						return;
					}
					sender.postMessage({ action: 'captured', 'data': dataUrl });
				});
			});
			*/
			chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
				var activeTab = tabs[0];
				if( chrome.scripting ){
					chrome.scripting.executeScript({
						target: { tabId: activeTab.id },
						function: captureFullPage
					});
				}else{
					chrome.tabs.executeScript( activeTab.id, { code:  '(' + captureFullPage + ')()' }, function(results){
						if (chrome.runtime.lastError) {
						console.error(chrome.runtime.lastError);
						port.postMessage({ action: 'capturederror', data: chrome.runtime.lastError.message });
						return;
						}

						const dataUrl = results[0];
						port.postMessage({ action: 'captured', data: dataUrl });
					});
				}
			});
		}
	});
});

function captureFullPage() {
  // Get the full scroll width and height of the document
  const fullWidth = Math.max(
    document.documentElement.scrollWidth,
    document.body.scrollWidth
  );
  const fullHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight
  );

  // Set the viewport size to the full dimensions
  document.documentElement.style.width = `${fullWidth}px`;
  document.documentElement.style.height = `${fullHeight}px`;

  // Create a canvas element to draw the full page
  //const canvas = document.createElement('canvas');
  const canvas = window.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
  canvas.width = fullWidth;
  canvas.height = fullHeight;

  // Draw the full page content onto the canvas
  const ctx = canvas.getContext('2d');
  ctx.drawWindow(window, 0, 0, fullWidth, fullHeight, 'rgb(255,255,255)');

  // Convert the canvas content to a data URL
  const dataUrl = canvas.toDataURL('image/png');

  // Restore the original viewport size
  document.documentElement.style.width = '';
  document.documentElement.style.height = '';

  // Return the data URL to the background script
  //chrome.runtime.sendMessage({ action: 'captured', data: dataUrl });
  dataUrl;
}




/*
// background.js

// Open a WebSocket server on a specific port
const server = new WebSocketServer(12345);

// Listen for connections
server.on('connection', (socket) => {
  console.log('Client connected.');

  // Handle messages from clients
  socket.on('message', (message) => {
    console.log('Received message:', message);

    // Send a response back to the client
    socket.send('Received your message: ' + message);
  });

  // Handle disconnections
  socket.on('close', () => {
    console.log('Client disconnected.');
  });
});

// Handle errors
server.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

// A simple WebSocket server implementation
function WebSocketServer(port) {
  const server = new WebSocket.Server({ port });

  server.on('connection', (socket) => {
    this.emit('connection', socket);

    socket.on('message', (message) => {
      this.emit('message', message, socket);
    });

    socket.on('close', () => {
      this.emit('close', socket);
    });
  });

  server.on('error', (error) => {
    this.emit('error', error);
  });

  return server;
}

// Inherit EventEmitter for custom events
const EventEmitter = require('events');
Object.setPrototypeOf(WebSocketServer.prototype, EventEmitter.prototype);
*/