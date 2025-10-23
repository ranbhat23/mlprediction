import * as tf from '@tensorflow/tfjs-node';

// 1. Data Interface (remains the same)
interface IntradayData {
    open: number;
    high: number;
    low: number;
    close: number;
}

// 2. Parsed Intraday Training Data (remains the same)
const rawData: IntradayData[] = [
    { open: 899.00, high: 906.00, low: 895.00, close: 902.00 },
    { open: 892.10, high: 902.10, low: 890.10, close: 897.25 },
    { open: 895.00, high: 907.40, low: 891.30, close: 897.80 },
    { open: 893.80, high: 897.70, low: 889.10, close: 895.20 },
    { open: 911.00, high: 912.55, low: 890.15, close: 893.80 },
    { open: 907.15, high: 920.60, low: 907.10, close: 912.35 },
    { open: 900.00, high: 911.35, low: 898.50, close: 907.15 },
    { open: 904.10, high: 912.80, low: 900.70, close: 905.25 },
    { open: 900.35, high: 910.00, low: 895.60, close: 904.10 },
    { open: 897.00, high: 907.00, low: 892.65, close: 900.35 },
    { open: 872.45, high: 896.50, low: 872.25, close: 895.05 },
    { open: 887.60, high: 887.60, low: 870.55, close: 872.45 },
    { open: 890.50, high: 898.25, low: 884.00, close: 888.20 },
    { open: 897.65, high: 902.10, low: 892.35, close: 894.25 },
    { open: 904.45, high: 908.65, low: 896.45, close: 897.65 },
    { open: 893.55, high: 913.80, low: 893.00, close: 904.50 },
    { open: 890.20, high: 899.85, low: 890.20, close: 893.55 },
    { open: 889.05, high: 892.95, low: 886.75, close: 889.40 },
    { open: 883.00, high: 888.00, low: 882.10, close: 885.35 },
];

/**
 * Calculates the Pivot Point (P) for the previous day.
 */
function calculatePivotPoint(prev: IntradayData): number {
    return (prev.high + prev.low + prev.close) / 3;
}

/**
 * Prepares the data using 5 lagged features including the Pivot Point.
 */
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
            pivot, // The new 5th feature
        ]);

        // Y: [Today's Close]
        labelArray.push(today.close);
    }

    // Input shape: [N samples, 5 features]
    const inputs = tf.tensor2d(featureArray, [featureArray.length, 5]);
    const labels = tf.tensor2d(labelArray, [labelArray.length, 1]);

    return { inputs, labels };
}


async function trainIntradayModel(data: IntradayData[]) {
    const { inputs, labels } = prepareLaggedDataWithPivot(data);

    // 4. Define the Model Architecture: inputShape MUST be 5
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 1, inputShape: [5] }));

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

/**
 * Predicts the closing price using all 5 necessary features.
 */
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
        prevDayPivot // The 5th feature
    ]];
    
    const inputTensor = tf.tensor2d(inputData, [1, 5]); 
    const predictionTensor = model.predict(inputTensor) as tf.Tensor;
    
    const prediction = predictionTensor.dataSync()[0];
    
    inputTensor.dispose();
    predictionTensor.dispose();

    return prediction;
}

// 7. Execution Logic
async function runStrategy() {
    try {
        const trainedModel = await trainIntradayModel(rawData);

        // --- Live Prediction for the new day (Open: 900.90) ---
        
        // Data for today's prediction (Current Open + Yesterday's OHLC)
        const yesterday = rawData[rawData.length - 1]; // Last day in the dataset
        
        // 1. New data point (Today's Open)
        const currentOpenPrice = 900.90; 
        
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
        const actualClose = 899.00;
        const deviation = predictedClose - actualClose;
        console.log(`\n--- Performance Check ---`);
        console.log(`Actual Close: $${actualClose.toFixed(2)}`);
        console.log(`Deviation: $${deviation.toFixed(2)}`);


        trainedModel.dispose();
        
    } catch (error) {
        console.error("An error occurred during the ML process:", error);
    }
}

runStrategy();
