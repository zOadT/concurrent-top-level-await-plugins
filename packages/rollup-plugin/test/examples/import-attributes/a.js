import "./b.js" with { type: "custom", "value": 42 };

await new Promise((resolve) => setTimeout(resolve, 5));
