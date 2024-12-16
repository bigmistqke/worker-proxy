export function getWorkerSource(filePath: string) {
  return /* javascript */ `import getApi from "${filePath}";
const workerChannels = {};
const api = getApi(
  new Proxy(
    {},
    {
      get(_, workerName) {
        return new Proxy(
          {},
          {
            get(_, property) {
              if (property === "$transfer") {
                return (...transferables) => {
                  return new Proxy(
                    {},
                    {
                      get(_, property) {
                        return (...data) =>
                          self.postMessage(
                            { topic: property, data },
                            transferables
                          );
                      },
                    }
                  );
                };
              }
              return (...data) => {
                workerChannels[workerName]?.postMessage({
                  topic: property,
                  data,
                });
              };
            },
          }
        );
      },
    }
  )
);
self.onmessage = async ({ data: { topic, data, name, port, id } }) => {
  if (id !== undefined) {
    const result = await api[topic](...data);
    self.postMessage({ id, data: result });
    return;
  }
  if (topic === "$send") {
    workerChannels[name] = port;
    return;
  }
  if (topic === "$receive") {
    port.onmessage = ({ data: { topic, data } }) => {
      api[topic](...data);
    };
    return;
  }
  api[topic](...data);
};`
}

export function getClientSource(workerUrl: string) {
  return /* javascript */ `
export default function(workers){
  const eventTarget = new EventTarget();
  const worker = new Worker(${JSON.stringify(workerUrl)}, { type: 'module' });
  
  let id = 0;
  
  const pendingMessages = {};
  
  worker.onmessage = ({ data: { topic, data, id } }) => {
    if (pendingMessages[id]) {
      pendingMessages[id](data);
      delete pendingMessages[id];
      return;
    }
    eventTarget.dispatchEvent(new CustomEvent(topic, { detail: data }));
  };
  
  return new Proxy({}, {
    get(target, property) {
      if (property === 'postMessage') {
        return (...args) => worker.postMessage(...args);
      }
      if (property === '$transfer') {
        return (...transferables) => {
          return new Proxy({}, {
            get(_, property) {
              if (property === '$async') {
                return new Proxy({}, {
                  get(target, property) {
                    return (...data) => {
                      id++;
                      worker.postMessage({ topic: property, data, id });
                      return new Promise((resolve) => {
                        pendingMessages[id] = resolve;
                      });
                    };
                  },
                });
              }
              return (...data) => {
                worker.postMessage({ topic: property, data }, transferables);
              };
            },
          });
        };
      }
      if (property === '$link') {
        return (name, otherWorker) => {
          const channel = new MessageChannel();
          worker.postMessage(
            { topic: '$send', name, port: channel.port1 },
            [channel.port1]
          );
          otherWorker.postMessage(
            { topic: '$receive', name, port: channel.port2 },
            [channel.port2]
          );
        };
      }
      if (property === '$on') {
        return new Proxy({}, {
          get(_, property) {
            return (callback) => {
              const abortController = new AbortController();
              eventTarget.addEventListener(
                property,
                (event) => callback(...event.detail),
                { signal: abortController.signal }
              );
              return () => abortController.abort();
            };
          },
        });
      }
      if (property === '$wait') {
        return new Proxy({}, {
          get(_, property) {
            return (...data) => {
              id++;
              worker.postMessage({ topic: property, data, id });
              return new Promise((resolve) => {
                pendingMessages[id] = resolve;
              });
            };
          },
        });
      }
      return (...data) => {
        worker.postMessage({ topic: property, data });
      };
    },
  });
};`
}
