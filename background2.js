(function () {

	const indexStorage = {
		dbName: 'capturefullpage',
		storeName: 'captures',

		openDatabase: function () {
			var dbName = this.dbName;
			var storeName = this.storeName;
			return new Promise((resolve, reject) => {
				const request = indexedDB.open(dbName, 1);

				request.onupgradeneeded = function (event) {
					const db = event.target.result;
					const objectStore = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
					objectStore.createIndex('name', 'name', { unique: true });
					//console.log('Database upgraded');
				};

				request.onsuccess = function (event) {
					resolve(event.target.result);
				};

				request.onerror = function (event) {
					reject(event.target.error);
				};
			});
		},

		set: function (name, data) {
			return new Promise((resolve, reject) => {
				this.openDatabase().then(db => {
					const transaction = db.transaction([this.storeName], 'readwrite');
					const objectStore = transaction.objectStore(this.storeName);
					const addRequest = objectStore.add({ 'name': name, 'value': data });

					addRequest.onsuccess = function (event) {
						resolve(event.target.result);
					};

					addRequest.onerror = function (event) {
						reject(event.target.error);
					};
				});
			});
		},

		get: function (name) {
			return new Promise((resolve, reject) => {
				this.openDatabase().then(db => {
					const transaction = db.transaction([this.storeName], 'readonly');
					const objectStore = transaction.objectStore(this.storeName);
					const index = objectStore.index('name');
					const getRequest = index.get(name);

					getRequest.onsuccess = function (event) {
						const result = event.target.result;
						if (result) {
							resolve(result);
						} else {
							resolve(null); // Name not found
						}
					};

					getRequest.onerror = function (event) {
						reject(event.target.error);
					};
				});
			});
		},

		getAll: function () {
			return new Promise((resolve, reject) => {
				this.openDatabase().then(db => {
					const transaction = db.transaction([this.storeName], 'readonly');
					const objectStore = transaction.objectStore(this.storeName);
					const cursorRequest = objectStore.openCursor();

					const results = [];

					cursorRequest.onsuccess = function (event) {
						const cursor = event.target.result;
						if (cursor) {
							results.push(cursor.value);
							cursor.continue();
						} else {
							resolve(results);
						}
					};

					cursorRequest.onerror = function (event) {
						reject(event.target.error);
					};
				});
			});
		},
	};

	function openScreenshot(id) {
		chrome.tabs.create({ 'url': chrome.runtime.getURL('open.html') + '?id=' + id });
	}

	var extensionId = chrome.runtime.id;

	chrome.runtime.onMessage.addListener(function (msg, senderPort) {
		//console.log("msg", msg, senderPort);
		if (chrome.runtime.lastError) {
			console.log(chrome.runtime.lastError);
		} else if (senderPort.id == extensionId && msg.action === 'capture') {
			chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
				if (chrome.runtime.lastError) {
					console.log(chrome.runtime.lastError);
					chrome.runtime.sendMessage({ action: 'capturederror', data: chrome.runtime.lastError.message }); // port
				}else if (tabs.length == 0) {
					chrome.runtime.sendMessage({ action: 'capturederror', data: "No active tab found. Try again." }); //port
				} else {
					var activeTab = tabs[0];

					chrome.tabs.sendMessage(activeTab.id, { action: 'initiateCapture' }, function (initiated) {

						if (chrome.runtime.lastError) {
							console.log(chrome.runtime.lastError);
							chrome.runtime.sendMessage({ action: 'capturederror', data: chrome.runtime.lastError.message }); //port
							return;
						}

						// Get the viewport dimensions
						chrome.tabs.sendMessage(activeTab.id, { action: 'getViewportSize' }, function (viewportSize) {

							if (chrome.runtime.lastError) {
								console.log(chrome.runtime.lastError);
								chrome.runtime.sendMessage({ action: 'capturederror', data: chrome.runtime.lastError.message }); //port
							} else if (viewportSize) {
								console.log(viewportSize);
								setTimeout(function () {
									// Capture multiple screenshots by scrolling
									var capturedParts = [];
									var offsets = [];
									var finishedOffsets = 0;
									for (let i = 0; i < viewportSize.totalHeight; i += viewportSize.innerHeight) { offsets.push(i); } console.log(offsets);
									var captureInterval = setInterval(function () {
										chrome.tabs.sendMessage(activeTab.id, { action: 'scrollAndCapture', scrollOffset: offsets[finishedOffsets] }, function (scrolledCapture) {
											if (chrome.runtime.lastError) {
												console.log(chrome.runtime.lastError);
												chrome.runtime.sendMessage({ action: 'capturederror', data: chrome.runtime.lastError.message }); //port
												clearInterval(captureInterval);
												return;
											}
											console.log( scrolledCapture );
											// Capture the visible area or implement further capture logic
											if (scrolledCapture == 'chrome') {
												setTimeout(function () {
													chrome.tabs.captureVisibleTab(activeTab.windowId || null, { format: 'png' }, function (dataUrl) {
														// Send the captured data back to the background script
														capturedParts.push(dataUrl);
														if (finishedOffsets >= offsets.length) {
															clearInterval(captureInterval);
															chrome.runtime.sendMessage({ action: 'captured', 'data': capturedParts, 'size': viewportSize, 'engine': 'chrome' }); //port
														}
													});
												}, 500);
											} else if (scrolledCapture == "html2canvas") {
												clearInterval(captureInterval); // content.js will send to popup
											} else {
												console.log(scrolledCapture);
												capturedParts.push(scrolledCapture);
												if (finishedOffsets >= offsets.length) {
													clearInterval(captureInterval);
													chrome.runtime.sendMessage({ action: 'captured', 'data': capturedParts, 'size': viewportSize, 'engine': 'script' }); //port
												}
											}

											finishedOffsets++;
										});
									}, 512);
								}, 512);
							} else {
								chrome.runtime.sendMessage({ action: 'capturederror', data: 'Viewport size is not returned' }); //port
							}

						});

					});
				}
			});
		
		} else if (senderPort.id == extensionId && msg.action === 'open') {
		} else if (senderPort.id == extensionId && msg.action === 'open') {
			if (typeof msg.id == 'undefined') {
				sendResponse(null);
			} else {
				chrome.storage.local.get([msg.id], function (data) {
					if (Object.keys(data).length > 0) {
						if (typeof senderPort.tab != 'undefined') {
							chrome.tabs.sendMessage(senderPort.tab.id, { 'action': 'opened', 'data': data[msg.id], 'id': msg.id });
						}
						sendResponse({ 'action': 'opened', 'data': data[msg.id], 'id': msg.id });
					}
				});
				sendResponse(true);
			}
		}
	});

	chrome.runtime.onInstalled.addListener(function () {

		chrome.contextMenus.create({ id: "captureContextMenu", title: "Capture", contexts: ["page"] });

		// Add a listener for the context menu item click
		chrome.contextMenus.onClicked.addListener(function (info, tab) {
			if (info.menuItemId === "captureContextMenu") {
				chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, function (dataUrl) {
					var name = "rand_" + (new Date()).getTime() + '_' + (Math.random() * 10).toString().replace('.', '');
					var storeData = {};
					storeData[name] = dataUrl;
					chrome.storage.local.set(storeData).then(function () {
						var data = { width: tab.width, height: tab.height, title: tab.title, url: tab.url, timestamp: (new Date()).getTime() };
						indexStorage.set(name, data).then(function (d) {
							openScreenshot(name);
						}, function (err) {
							chrome.storage.session.set(name, function () {
								if (chrome.runtime.lastError) {
									alert('Error: ' + chrome.runtime.lastError);
								} else {
									openScreenshot(name);
								}
							});
						});
					});
				});
			}
		});

	});

})();