
import { runStrategy } from './multilinear.js';
import { transform } from './csvtojson.js';
import { GoogleSheetManager } from './googlesheets.js';
import credentials from '../gsheetskey.json' with { type: 'json' };
import { Config } from './config.js';
import { transformOhlc} from './utils.js';

async function main() {
  try {
   const _gsheet = GoogleSheetManager.getInstance(Config.SPREADSHEET_ID);
  const _val= await _gsheet.getStockClosePrice("NSE:HINDALCO");
  console.log(_val);
    const _ohlc = await _gsheet.getOhlcArrays();
    console.log(_ohlc);
   const _ohlclist = transformOhlc(_ohlc);
   console.log(_ohlclist);
    await runStrategy(_ohlclist);
  }
  catch (err) {
    console.log(err);
  }
}
main();