import * as tf from '@tensorflow/tfjs-node'; // Use -node for performance
// --- ADD THIS LINE ---
tf.setBackend('cpu'); // Optional: Helps with consistency if you have a GPU
tf.random.setSeed(42); // Set a fixed seed (42 is a common convention)
// ---------------------
// --- NEW DATA INPUT ---
const stockData = [
  // IMPORTANT: The data must be in chronological order (oldest to newest).
  // I will reverse the provided data to assume the last entry is the most recent.
  { open: 745.9, high: 749.5, low: 731.95, close: 743.85 },
  { open: 745, high: 758.8, low: 744.85, close: 753.8 },
  { open: 759.95, high: 769.7, low: 758.05, close: 761.95 },
  { open: 761.9, high: 769.4, low: 755.3, close: 765.95 },
  { open: 766, high: 790.6, low: 764.1, close: 780.35 },
  { open: 782.05, high: 784.95, low: 774.35, close: 776.7 },
  { open: 771, high: 780.75, low: 765.9, close: 767.8 },
  { open: 770, high: 781.5, low: 766.15, close: 768.2 },
  { open: 770.25, high: 780, low: 769.25, close: 774.1 },
  { open: 774.5, high: 775.75, low: 764.3, close: 773.95 },
  { open: 772.25, high: 774.6, low: 767.2, close: 770.2 },
  { open: 776.05, high: 781.55, low: 754.45, close: 760.1 },
  { open: 765, high: 768.7, low: 759.35, close: 764.25 },
  { open: 765.1, high: 780.85, low: 763.5, close: 780.1 },
  { open: 780, high: 781.95, low: 766, close: 772.8 },
  { open: 774.3, high: 789.45, low: 772.05, close: 786.35 },
  { open: 791, high: 791.95, low: 782.5, close: 784.95 },
  { open: 791.5, high: 799.85, low: 784, close: 792.4 }, // Last known day (t-1)
  { open: 811.35, high: 826.5, low: 811.35, close: 824.45 } // Prediction Day (t) - **Actual Close is 824.45**
];

// Determine min/max across all relevant price data for scaling
const ALL_PRICES = stockData.flatMap(d => [d.open, d.high, d.low, d.close]);
const MIN_PRICE = Math.min(...ALL_PRICES); // 731.95
const MAX_PRICE = Math.max(...ALL_PRICES); // 826.5

// --- 1. Scaling Helper Functions ---
function scale(price) {
    if (MAX_PRICE === MIN_PRICE) return 0.5;
    return (price - MIN_PRICE) / (MAX_PRICE - MIN_PRICE);
}

function denormalize(scaledPrice) {
    return scaledPrice * (MAX_PRICE - MIN_PRICE) + MIN_PRICE;
}

// --- 2. Data Preparation Function (5 Features including PP) ---
function prepareLaggedData(data) {
    const inputs = [];
    const labels = [];
    
    for (let i = 1; i < data.length; i++) {
        const today = data[i];
        const yesterday = data[i - 1];

        // 5th Feature: Pivot Point (PP)
        const yesterdayPP = (yesterday.high + yesterday.low + yesterday.close) / 3;

        // X (Input Features) - 5 features: Open, H(t-1), L(t-1), C(t-1), PP(t-1)
        const features = [
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

    const inputTensor = tf.tensor2d(inputs);
    const labelTensor = tf.tensor2d(labels);

    return { inputTensor, labelTensor };
}

// --- 3. Model Definition and Training (Input Shape [5]) ---
function createModel() {
    const model = tf.sequential();
    
    // Input shape is [5] for (Open, H, L, C, PP)
    model.add(tf.layers.dense({ 
        units: 1, 
        inputShape: [5] // <--- CORRECTED: Input shape is 5
    }));
    
    model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'meanSquaredError',
    });

    return model;
}

// --- 4. Main Execution Strategy ---
async function runStrategy() {
    // 1. Separate Training Data from Prediction Day
    // The last day is for prediction, all before it are for training (i.e., days 1 to 18)
    const trainingData = stockData.slice(0, stockData.length - 1);
    const predictionDay = stockData[stockData.length - 1]; 
    const { inputTensor, labelTensor } = prepareLaggedData(trainingData);

    // 2. Create and Train Model
    const model = createModel();

    console.log("Starting model training with 5 features...");
    await model.fit(inputTensor, labelTensor, {
        epochs: 500, 
        verbose: 0,
        callbacks: { 
            onEpochEnd: (epoch, logs) => {
                if (epoch % 100 === 0) console.log(`Epoch ${epoch}: Loss = ${logs.loss.toFixed(6)}`);
            }
        }
    });
    console.log("Training complete.");

    // 3. Prepare NEW Input for Prediction
    const lastDataPoint = stockData[stockData.length - 2]; // Day (t-1)
    
    // Calculate Pivot Point for the last known day
    const lastDayPP = (lastDataPoint.high + lastDataPoint.low + lastDataPoint.close) / 3;

    // Create the 5-feature input tensor for prediction day (t)
    const newFeatures = [
        scale(predictionDay.open), 
        scale(lastDataPoint.high),
        scale(lastDataPoint.low),
        scale(lastDataPoint.close),
        scale(lastDayPP) 
    ];

    // 4. Predict
    const predictedClose = tf.tidy(() => {
        const predictionTensor = tf.tensor2d([newFeatures]);
        const predictionScaled = model.predict(predictionTensor);
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
    const actualClose = predictionDay.close;
    const deviation = predictedClose - actualClose;
    console.log(`Actual Close: $${actualClose.toFixed(2)}`);
    console.log(`Deviation: $${deviation.toFixed(2)}`);
    
    // Cleanup
    model.dispose();
    inputTensor.dispose();
    labelTensor.dispose();
}

// Execute the strategy
runStrategy();
