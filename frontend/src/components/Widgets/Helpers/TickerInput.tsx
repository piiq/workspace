import DebouncedInput from "~/components/General/Table/DebouncedInput";
import type { Ticker } from "~/components/types";
import GroupDropdown from "./GroupDropdown";

export default function TickerInput({
  ticker,
  onChange,
}: {
  ticker: Ticker;
  onChange: (ticker: Ticker) => void;
}) {
  return (
    <GroupDropdown type="ticker">
      <DebouncedInput
        aria-label="Ticker symbol"
        className="bg-transparent outline-hidden text-xs min-w-16"
        sizeToContent={true}
        value={ticker.symbol}
        onChange={(value) => {
          const symbol = String(value).trim();
          if (!symbol || symbol === ticker.symbol) return;
          onChange({
            id: symbol,
            symbol,
            category: ticker.category,
            type: ticker.type,
          });
        }}
      />
    </GroupDropdown>
  );
}
