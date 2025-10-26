// ---------------
// MAIN LOGIC 
//---------------
/*
import * as tf from '@tensorflow/tfjs';

//import * as tf from '@tensorflow/tfjs-node';
// 1. Data Interface (remains the same)
interface IntradayData {
    open: number;
    high: number;
    low: number;
    close: number;
}
function calculatePivotPoint(prev: IntradayData): number {
    return (prev.high + prev.low + prev.close) / 3;
}

function prepareLaggedDataWithPivot(data: IntradayData[]) {
    const featureArray: number[][] = [];
    const labelArray: number[] = [];

    // Start from the second data point (index 1)
    for (let i = 1; i < data.length; i++) {
        const today = data[i];
        const yesterday = data[i - 1];

        // Calculate Pivot Point (P) for yesterday's data
        const pivot = calculatePivotPoint(yesterday);

        // X: [Open_Today, High_Prev, Low_Prev, Close_Prev, Pivot_Prev]
        featureArray.push([
            today.open,
            yesterday.high,
            yesterday.low,
            yesterday.close,
 //           pivot, // The new 5th feature
        ]);

        // Y: [Today's Close]
        labelArray.push(today.close);
//        labelArray.push(today.high);
    }

    // Input shape: [N samples, 5 features]
    const inputs = tf.tensor2d(featureArray, [featureArray.length, 4]);
    const labels = tf.tensor2d(labelArray, [labelArray.length, 1]);

    return { inputs, labels };
}


async function trainIntradayModel(data: IntradayData[]) {
    const { inputs, labels } = prepareLaggedDataWithPivot(data);

    // 4. Define the Model Architecture: inputShape MUST be 5
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 1, inputShape: [4] }));

    // 5. Compile and Train
    model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'meanSquaredError',
    });

    console.log('Starting model training...');
    await model.fit(inputs, labels, { epochs: 150, verbose: 0 }); 
    console.log('Training complete.');
    
    inputs.dispose();
    labels.dispose();
    
    return model;
}

function predictPrice(
    model: tf.Sequential, 
    currentOpenPrice: number, 
    prevDayHigh: number, 
    prevDayLow: number, 
    prevDayClose: number
): number {
    // Calculate the Pivot Point for the previous day's data
    const prevDayPivot = (prevDayHigh + prevDayLow + prevDayClose) / 3;

    // Input vector must match the training shape: [1 sample, 5 features]
    const inputData = [[
        currentOpenPrice, 
        prevDayHigh, 
        prevDayLow, 
        prevDayClose, 
//        prevDayPivot // The 5th feature
    ]];
    
    const inputTensor = tf.tensor2d(inputData, [1, 4]); 
    const predictionTensor = model.predict(inputTensor) as tf.Tensor;
    
    const prediction = predictionTensor.dataSync()[0];
    
    inputTensor.dispose();
    predictionTensor.dispose();

    return prediction;
}

// 7. Execution Logic
export async function runStrategy(data : IntradayData[]) {
    try {
//         rawData = data;
        const trainedModel = await trainIntradayModel(data);
        // --- Live Prediction for the new day (Open: 900.90) ---
        // Data for today's prediction (Current Open + Yesterday's OHLC)
        const yesterday = data[data.length - 1]; // Last day in the dataset
        
        // 1. New data point (Today's Open)
        const currentOpenPrice = 811.25;         
        // 2. Previous Day's fixed data (Yesterday)
        const prevDayHigh = yesterday.high;    // 888.00
        const prevDayLow = yesterday.low;      // 882.10
        const prevDayClose = yesterday.close;  // 885.35 
        
        // Calculate Yesterday's Pivot Point
        const prevDayPivot = calculatePivotPoint(yesterday);
        // Pivot: (888.00 + 882.10 + 885.35) / 3 = 885.15

        // Make the prediction using all five known inputs
        const predictedClose = predictPrice(
            trainedModel, 
            currentOpenPrice, 
            prevDayHigh, 
            prevDayLow, 
            prevDayClose
        );

        console.log(`\n--- Model Parameters ---`);
        console.log(`Inputs: Open=${currentOpenPrice.toFixed(2)}, Prev H/L/C=${prevDayHigh.toFixed(2)}/${prevDayLow.toFixed(2)}/${prevDayClose.toFixed(2)}, Pivot=${prevDayPivot.toFixed(2)}`);

        console.log(`\n--- Strategy Output ---`);
        console.log(`Current Open Price: $${currentOpenPrice.toFixed(2)}`);
        console.log(`Predicted Close Price: $${predictedClose.toFixed(2)}`);

        // Simple Decision Logic
        if (predictedClose > currentOpenPrice * 1.001) { 
            console.log(`**Decision:** 🚀 BUY - Prediction is significantly higher than open.`);
        } else if (predictedClose < currentOpenPrice * 0.999) { 
            console.log(`**Decision:** 📉 SELL/SHORT - Prediction is significantly lower than open.`);
        } else {
            console.log(`**Decision:** 🟡 HOLD - Prediction is too close to the open price.`);
        }

        // Output comparison with actual close of 899.00
 //       const actualClose = 116.50;
        const actualClose = 825;
   //     const deviation = (predictedClose - actualClose )/ actualClose * 100;
        const deviation = predictedClose - actualClose;
        console.log(`\n--- Performance Check ---`);
        console.log(`Actual Close: $${actualClose.toFixed(2)}`);
        console.log(`Deviation: $${deviation.toFixed(2)}`);

        trainedModel.dispose();
        
    } catch (error) {
        console.error("An error occurred during the ML process:", error);
    }
}

//runStrategy();
*/