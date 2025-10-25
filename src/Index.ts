
import { simpleRunStrategy } from './simplelinear.js';
import { GoogleSheetManager } from './googlesheets.js';
import { Config } from './config.js';
import { transformOhlc} from './utils.js';

async function main() {
  try {
   const _gsheet = GoogleSheetManager.getInstance(Config.SPREADSHEET_ID);
  const _val= await _gsheet.getStockClosePrice("NSE:PNB");
    const _ohlc = await _gsheet.getOhlcArrays();
   const _ohlclist = transformOhlc(_ohlc);
  const _result=[..._ohlclist].reverse();
    await simpleRunStrategy(_result);
  }
  catch (err) {
    console.log(err);
  }
}
main();
