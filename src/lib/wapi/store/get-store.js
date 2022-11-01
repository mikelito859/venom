const { storeObjects } = require('./store-objects');
export async function getStore(modules) {
  let foundCount = 0;
  let neededObjects = storeObjects;
  for (let idx in modules) {
    if (typeof modules[idx] === 'object' && modules[idx] !== null) {
      neededObjects.forEach((needObj) => {
        if (!needObj.conditions || needObj.foundedModule) return;
        let neededModule = needObj.conditions(modules[idx]);
        if (neededModule !== null) {
          foundCount++;
          needObj.foundedModule = neededModule;
        }
      });
      if (foundCount == neededObjects.length) {
        break;
      }
    }
  }

  console.log(neededObjects);
  let neededStore = neededObjects.find((needObj) => needObj.id === 'Store');
  console.log(neededStore);
  window.Store = neededStore.foundedModule ? neededStore.foundedModule : {};
  neededObjects.splice(neededObjects.indexOf(neededStore), 1);

  neededObjects.forEach((needObj) => {
    if (needObj.foundedModule) {
      window.Store[needObj.id] = needObj.foundedModule;
    }
  });

  window.Store.sendMessage = function (e) {
    return window.Store.SendTextMsgToChat(this, ...arguments);
  };
  window.Store.Chat.modelClass.prototype.sendMessage = function (e) {
    window.Store.SendTextMsgToChat(this, ...arguments);
  };

  if (window.Store.MediaCollection)
    window.Store.MediaCollection.prototype.processFiles =
      window.Store.MediaCollection.prototype.processFiles ||
      window.Store.MediaCollection.prototype.processAttachments;

  Store.Chat._findAndParse = Store.BusinessProfile._findAndParse;
  Store.Chat._find = Store.BusinessProfile._find;

  console.log(window.Store);
  return window.Store;
}
