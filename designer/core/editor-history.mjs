/** Local, bounded snapshot history for the Designer. Never persists secrets or source files. */
export function createEditorHistory(limit=50){
 if(!Number.isInteger(limit)||limit<1||limit>200)throw Error('Ugyldig historikkgrense.');
 let past=[],future=[];
 const snapshot=value=>structuredClone(value);
 return {
  get canUndo(){return past.length>0},
  get canRedo(){return future.length>0},
  record(before,after){
   if(JSON.stringify(before)===JSON.stringify(after))return false;
   past.push(snapshot(before));if(past.length>limit)past.shift();future=[];return true;
  },
  undo(current){if(!past.length)return null;future.push(snapshot(current));return past.pop()},
  redo(current){if(!future.length)return null;past.push(snapshot(current));return future.pop()},
  reset(){past=[];future=[]},
  get length(){return past.length}
 };
}
