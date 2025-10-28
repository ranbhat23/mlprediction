
import { simpleRunStrategy } from './simplelinear.js';
import { mrlRunStrategy } from './mrlinear.js';
import { GoogleSheetManager } from './googlesheets.js';
import { Config } from './config.js';
import { transformOhlc, transformOhlcv, jsonToHtmlTable, StockDataItem, transformOhlcpp } from './utils.js';
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
    const _val = await _gsheet.getCellValue("NSE:" + _symbol);// C6 is open F6 is close
    const YELLOW = '\x1b[33m';
    const BLUE = '\x1b[34m';
    const MAGENTA = '\x1b[35m';
    const RESET = '\x1b[0m';

    console.log(`${YELLOW}open: ${_val?.open}${RESET} ${BLUE} ${YELLOW}high: ${_val?.high}${RESET}${YELLOW}low: ${_val?.low}${RESET} close: ${_val?.close}${RESET} ${MAGENTA} PivotPoint: ${_val?.pp}${RESET}`);
    //    const _ohlc = await _gsheet.getOhlcArrays();
    //    const _ohlclist = transformOhlc(_ohlc);
    //    const _result = [..._ohlclist].reverse();
    //        const _ohlcpp = await _gsheet.getOhlcppArrays();
    //    const _ohlclistpp = transformOhlcpp(_ohlcpp);
    //    const _res = [..._ohlclistpp].reverse();
    //  jsonToHtmlTable(_res as StockDataItem[]);  
    //    await simpleRunStrategy(_result); // using teserflowjs with less features
    // best one for now.
    const _ohlcv = await _gsheet.getOhlcvArrays();
    const _ohlcvlist = transformOhlcv(_ohlcv);
    const _vresult = [..._ohlcvlist].reverse();
    console.log('open'+_val?.open);
    await mrlRunStrategy(_vresult, _val?.open);
  }
  catch (err) {
    console.log(err);
  }
}
main();
