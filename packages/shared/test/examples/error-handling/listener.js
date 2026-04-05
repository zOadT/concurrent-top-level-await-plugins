process.on("unhandledRejection", (reason, promise) => {
	trace("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
	trace("Uncaught Exception:", error);
});
