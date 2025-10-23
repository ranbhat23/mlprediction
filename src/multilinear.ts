import * as tf from '@tensorflow/tfjs-node';

// 1. Data Interface
interface IntradayData {
    open: number;
    high: number;
    low: number;
    close: number;
}

// 2. Parsed Intraday Training Data
// We use your historical data (Date is for context, not model input)
const rawData: IntradayData[] = [
    { open: 899.00, high: 906.00, low: 895.00, close: 902.00 }, // Day 1
    { open: 892.10, high: 902.10, low: 890.10, close: 897.25 }, // Day 2
    { open: 895.00, high: 907.40, low: 891.30, close: 897.80 }, // Day 3
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
 * Prepares the data using lagged features (Prev Day High/Low/Close)
 * to predict Today's Close.
 */
function prepareLaggedData(data: IntradayData[]) {
    const featureArray: number[][] = [];
    const labelArray: number[] = [];

    // Start from the second data point (index 1) because the first
    // data point has no "previous day" to draw from.
    for (let i = 1; i < data.length; i++) {
        const today = data[i];
        const yesterday = data[i - 1];

        // X: [Today's Open, Yesterday's High, Yesterday's Low, Yesterday's Close]
        featureArray.push([
            today.open,
            yesterday.high,
            yesterday.low,
            yesterday.close,
        ]);

        // Y: [Today's Close]
        labelArray.push(today.close);
    }

    // Input shape: [N samples, 4 features]
    const inputs = tf.tensor2d(featureArray, [featureArray.length, 4]);
    const labels = tf.tensor2d(labelArray, [labelArray.length, 1]);

    return { inputs, labels };
}


async function trainIntradayModel(data: IntradayData[]) {
    const { inputs, labels } = prepareLaggedData(data);

    // 4. Define the Model Architecture (Simple Linear Model: y = w1x1 + w2x2 + w3x3 + w4x4 + b)
    const model = tf.sequential();
    // inputShape must be 4 (one for each feature)
    model.add(tf.layers.dense({ units: 1, inputShape: [4] }));

    // 5. Compile the Model (Using Adam optimizer for better convergence)
    model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'meanSquaredError',
    });

    console.log('Starting model training...');
    
    // 6. Train the Model (Increased epochs due to small dataset size)
    await model.fit(inputs, labels, { epochs: 150, verbose: 0 }); 

    console.log('Training complete.');
    
    // Clean up tensors
    inputs.dispose();
    labels.dispose();
    
    return model;
}

/**
 * Predicts the closing price using the 4 necessary features.
 */
function predictPrice(
    model: tf.Sequential, 
    currentOpenPrice: number, 
    prevDayHigh: number, 
    prevDayLow: number, 
    prevDayClose: number
): number {
    // Input vector must match the training shape: [1 sample, 4 features]
    const inputData = [[currentOpenPrice, prevDayHigh, prevDayLow, prevDayClose]];
    
    const inputTensor = tf.tensor2d(inputData, [1, 4]); 
    const predictionTensor = model.predict(inputTensor) as tf.Tensor;
    
    const prediction = predictionTensor.dataSync()[0];
    
    // Clean up tensors
    inputTensor.dispose();
    predictionTensor.dispose();

    return prediction;
}

// 7. Execution Logic
async function runStrategy() {
    try {
        const trainedModel = await trainIntradayModel(rawData);

        // --- Live Prediction for the new day ---
        
        // Data for today's prediction (Current Open + Yesterday's OHLC)
        // We use the LAST day's data from the rawData list as "Yesterday's" fixed data
        const yesterday = rawData[rawData.length - 1]; 

        // 1. New data point (Today's Open)
        const currentOpenPrice = 900.90; 
        
        // 2. Previous Day's fixed data (Yesterday)
        const prevDayHigh = yesterday.high;    // 888.00
        const prevDayLow = yesterday.low;      // 882.10
        const prevDayClose = yesterday.close;  // 885.35 
        
        // Make the prediction using all four known inputs
        const predictedClose = predictPrice(
            trainedModel, 
            currentOpenPrice, 
            prevDayHigh, 
            prevDayLow, 
            prevDayClose
        );

        console.log(`\n--- Model Parameters ---`);
        console.log(`Input Features (Today's Open: ${currentOpenPrice.toFixed(2)}, Prev H/L/C: ${prevDayHigh.toFixed(2)}/${prevDayLow.toFixed(2)}/${prevDayClose.toFixed(2)})`);

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

        trainedModel.dispose();
        
    } catch (error) {
        console.error("An error occurred during the ML process:", error);
    }
}

// runStrategy(); // Uncomment to run this in your Node.js environment
