export default function TVChartUnavailable({
  extraClassName,
  message = "Advanced charts are unavailable in this workspace. Install the TradingView plugin and connect a UDF-compatible datafeed.",
}: {
  extraClassName?: string;
  message?: string;
}) {
  return (
    <div role="alert" data-testid="tv-chart-unavailable" className={extraClassName}>
      {message}
    </div>
  );
}
