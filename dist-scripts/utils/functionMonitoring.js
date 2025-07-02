class FunctionMonitor {
    constructor() {
        this.metrics = [];
        this.maxMetrics = 1000;
    }
    static getInstance() {
        if (!FunctionMonitor.instance) {
            FunctionMonitor.instance = new FunctionMonitor();
        }
        return FunctionMonitor.instance;
    }
    recordMetric(metric) {
        this.metrics.push(metric);
        // Keep only recent metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }
        // Log expensive operations
        if (metric.duration > 5000) {
            console.error(`[EXPENSIVE FUNCTION] ${metric.path} took ${metric.duration}ms`);
        }
    }
    getMetricsSummary(minutes = 60) {
        const cutoff = new Date(Date.now() - minutes * 60 * 1000);
        const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff);
        const summary = recentMetrics.reduce((acc, metric) => {
            if (!acc[metric.path]) {
                acc[metric.path] = {
                    count: 0,
                    totalDuration: 0,
                    maxDuration: 0,
                    avgDuration: 0,
                    errors: 0,
                    timeouts: 0,
                };
            }
            const pathMetrics = acc[metric.path];
            pathMetrics.count++;
            pathMetrics.totalDuration += metric.duration;
            pathMetrics.maxDuration = Math.max(pathMetrics.maxDuration, metric.duration);
            pathMetrics.avgDuration = pathMetrics.totalDuration / pathMetrics.count;
            if (metric.status === 'error')
                pathMetrics.errors++;
            if (metric.status === 'timeout')
                pathMetrics.timeouts++;
            return acc;
        }, {});
        return summary;
    }
    getExpensiveFunctions(thresholdMs = 3000) {
        const summary = this.getMetricsSummary();
        return Object.entries(summary)
            .filter(([_, metrics]) => metrics.avgDuration > thresholdMs)
            .sort((a, b) => b[1].avgDuration - a[1].avgDuration)
            .map(([path, metrics]) => (Object.assign(Object.assign({ path }, metrics), { estimatedMonthlyCost: this.estimateCost(metrics) })));
    }
    estimateCost(metrics) {
        // Vercel pricing: $0.18 per GB-hour
        // Assume 1GB memory allocation
        const gbHours = (metrics.totalDuration / 1000 / 3600) * 1;
        const costPerGbHour = 0.18;
        // Extrapolate to monthly
        const hourlyCalls = metrics.count;
        const monthlyCalls = hourlyCalls * 24 * 30;
        const monthlyGbHours = (metrics.avgDuration / 1000 / 3600) * monthlyCalls;
        return monthlyGbHours * costPerGbHour;
    }
}
export const functionMonitor = FunctionMonitor.getInstance();
// Helper to wrap async functions with monitoring
export function withMonitoring(path, fn) {
    return (async (...args) => {
        const startTime = Date.now();
        let status = 'success';
        let errorMessage;
        try {
            const result = await fn(...args);
            return result;
        }
        catch (error) {
            status = 'error';
            errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw error;
        }
        finally {
            const duration = Date.now() - startTime;
            functionMonitor.recordMetric({
                path,
                duration,
                timestamp: new Date(),
                status,
                errorMessage,
            });
        }
    });
}
