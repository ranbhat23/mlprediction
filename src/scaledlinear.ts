/*

import * as tf from '@tensorflow/tfjs'; // Use -node for performance

// --- TYPE DEFINITIONS ---
// 1. Interface for a single stock data point
interface StockDay {
    open: number;
    high: number;
    low: number;
    close: number;
}

// 2. Type for the prepared data output
interface PreparedData {
    inputTensor: tf.Tensor2D;
    labelTensor: tf.Tensor2D;
}
// ------------------------

tf.setBackend('cpu'); // Optional: Helps with consistency if you have a GPU
//tf.random.setSeed(42); // Set a fixed seed (42 is a common convention)

// --- NEW DATA INPUT ---
let stockData: StockDay[] = [
    // IMPORTANT: The data must be in chronological order (oldest to newest).
    { open: 745.9, high: 749.5, low: 731.95, close: 743.85 },
    { open: 745, high: 758.8, low: 744.85, close: 753.8 },
    { open: 759.95, high: 769.7, low: 758.05, close: 761.95 },
    { open: 791.5, high: 799.85, low: 784, close: 792.4 }, // Last known day (t-1)
    { open: 811.35, high: 826.5, low: 811.35, close: 824.45 } // Prediction Day (t) - **Actual Close is 824.45**
];

// Determine min/max across all relevant price data for scaling
const ALL_PRICES: number[] = stockData.flatMap(d => [d.open, d.high, d.low, d.close]);
const MIN_PRICE: number = Math.min(...ALL_PRICES); // 731.95
const MAX_PRICE: number = Math.max(...ALL_PRICES); // 826.5

// --- 1. Scaling Helper Functions ---
function scale(price: number): number {
    if (MAX_PRICE === MIN_PRICE) return 0.5;
    return (price - MIN_PRICE) / (MAX_PRICE - MIN_PRICE);
}

function denormalize(scaledPrice: number): number {
    return scaledPrice * (MAX_PRICE - MIN_PRICE) + MIN_PRICE;
}

// --- 2. Data Preparation Function (5 Features including PP) ---
function prepareLaggedData(data: StockDay[]): PreparedData {
    const inputs: number[][] = [];
    const labels: number[][] = [];
    
    for (let i = 1; i < data.length; i++) {
        const today: StockDay = data[i];
        const yesterday: StockDay = data[i - 1];

        // 5th Feature: Pivot Point (PP)
        const yesterdayPP: number = (yesterday.high + yesterday.low + yesterday.close) / 3;

        // X (Input Features) - 5 features: Open, H(t-1), L(t-1), C(t-1), PP(t-1)
        const features: number[] = [
            scale(today.open),
            scale(yesterday.high),
            scale(yesterday.low),
            scale(yesterday.close),
            scale(yesterdayPP) 
        ];
        inputs.push(features);

        // Y (Label/Target) - Today's Close
        labels.push([scale(today.close)]);
    }

    const inputTensor: tf.Tensor2D = tf.tensor2d(inputs);
    const labelTensor: tf.Tensor2D = tf.tensor2d(labels);

    return { inputTensor, labelTensor };
}

// --- 3. Model Definition and Training (Input Shape [5]) ---
function createModel(): tf.Sequential {
    const model: tf.Sequential = tf.sequential();
    
    // Input shape is [5] for (Open, H, L, C, PP)
    model.add(tf.layers.dense({ 
        units: 1, 
        inputShape: [5] // <--- Input shape is 5
    }));
    
    model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'meanSquaredError',
    });

    return model;
}

// --- 4. Main Execution Strategy ---
export async function runStrategy(excelData : StockDay[]) {
    // 1. Separate Training Data from Prediction Day
    // The last day is for prediction, all before it are for training (i.e., days 1 to 18)
    stockData = excelData;
    const trainingData: StockDay[] = stockData.slice(0, stockData.length - 1);
    const predictionDay: StockDay = stockData[stockData.length - 1]; 
    const { inputTensor, labelTensor }: PreparedData = prepareLaggedData(trainingData);

    // 2. Create and Train Model
    const model: tf.Sequential = createModel();

    console.log("Starting model training with 5 features...");
    await model.fit(inputTensor, labelTensor, {
        epochs: 500, 
        verbose: 0,
        callbacks: { 
            onEpochEnd: (epoch: number, logs: tf.Logs | undefined) => {
                if (epoch % 100 === 0 && logs) {
                    // Type guard for logs
                    console.log(`Epoch ${epoch}: Loss = ${logs.loss.toFixed(6)}`);
                }
            }
        }
    });
    console.log("Training complete.");

    // 3. Prepare NEW Input for Prediction
    const lastDataPoint: StockDay = stockData[stockData.length - 2]; // Day (t-1)
    
    // Calculate Pivot Point for the last known day
    const lastDayPP: number = (lastDataPoint.high + lastDataPoint.low + lastDataPoint.close) / 3;

    // Create the 5-feature input tensor for prediction day (t)
    const newFeatures: number[] = [
        scale(predictionDay.open), 
        scale(lastDataPoint.high),
        scale(lastDataPoint.low),
        scale(lastDataPoint.close),
        scale(lastDayPP) 
    ];

    // 4. Predict
    const predictedClose: number = tf.tidy(() => {
        const predictionTensor: tf.Tensor2D = tf.tensor2d([newFeatures]);
        const predictionScaled: tf.Tensor<tf.Rank> = model.predict(predictionTensor) as tf.Tensor<tf.Rank>;
        return denormalize(predictionScaled.dataSync()[0]);
    });
    
    // 5. Output Results
    console.log(`\n--- Scaling Parameters ---`);
    console.log(`Min Price: ${MIN_PRICE.toFixed(2)}, Max Price: ${MAX_PRICE.toFixed(2)}`);
    console.log(`Last Day's Pivot Point (PP): $${lastDayPP.toFixed(2)}`);
    
    console.log(`\n--- Strategy Output ---`);
    console.log(`Prediction Open Price: $${predictionDay.open.toFixed(2)}`);
    console.log(`Predicted Close Price: $${predictedClose.toFixed(2)}`);
    
    // 6. Performance Check
    console.log(`\n--- Performance Check ---`);
    const actualClose: number = predictionDay.close;
    const deviation: number = predictedClose - actualClose;
    console.log(`Actual Close: $${actualClose.toFixed(2)}`);
    console.log(`Deviation: $${deviation.toFixed(2)}`);
    
    // Cleanup
    model.dispose();
    inputTensor.dispose();
    labelTensor.dispose();
}
    */