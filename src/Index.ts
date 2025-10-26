
import { simpleRunStrategy } from './simplelinear.js';
import { mrlRunStrategy } from './mrlinear.js';
import { GoogleSheetManager } from './googlesheets.js';
import { Config } from './config.js';
import { transformOhlc,transformOhlcv } from './utils.js';
import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";

export function getuserInput(query: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  return new Promise(resolve => { rl.question(query, (answer) => { rl.close(); resolve(answer) }) });
}

async function main() {
  try {
    const _gsheet = GoogleSheetManager.getInstance(Config.SPREADSHEET_ID);
    const _symbol = await getuserInput("ENTER NSE SYMBOL - ");
    const _openval = await getuserInput("ENTER OPEN PRICE - ");
    const _val = await _gsheet.getStockClosePrice("NSE:" + _symbol);
    const _ohlc = await _gsheet.getOhlcArrays();
    const _ohlclist = transformOhlc(_ohlc);
    const _result = [..._ohlclist].reverse();
//    await simpleRunStrategy(_result);

  const _ohlcv = await _gsheet.getOhlcvArrays();
    const _ohlcvlist = transformOhlcv(_ohlcv);
    const _vresult = [..._ohlcvlist].reverse();
    await mrlRunStrategy(_vresult,  parseFloat(_openval));
 
  }
  catch (err) {
    console.log(err);
  }
}
main();
