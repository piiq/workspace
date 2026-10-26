import { useMemo } from "react";
import DraggableCard from "~/components/DraggableCard";
import { useWidgetContext } from "~/components/Widget.context";
import {
  useEquityFundamentalOverview,
  useEquityOwnershipShareStatistics,
} from "~/lib/api/sdkComponents";
import type { FMPCompanyOverviewData as CompanyOverview } from "~/lib/api/sdkSchemas";
import { formatNumber } from "~/lib/utils";
import AdvancedSelectedTicker from "../Helpers/AdvancedSelectTicker";
import TVChartUnavailable from "../TVChartContainer/TVChartUnavailable";

function useOverviewData() {
  const widget = useWidgetContext()?.widget;

  const {
    data: overviewQuery,
    dataUpdatedAt,
    isLoading,
  } = useEquityFundamentalOverview<{ results: CompanyOverview }>(
    {
      queryParams: {
        provider: "fmp",
        symbol: widget.data?.mainTicker?.symbol ?? "AAPL",
      },
    },
    {
      enabled: widget.data?.mainTicker?.symbol !== null,
      staleTime: 1000 * 60 * 5,
    },
  );

  const { data: faShares } = useEquityOwnershipShareStatistics(
    {
      queryParams: {
        provider: "fmp",
        symbol: widget.data?.mainTicker?.symbol ?? "AAPL",
      },
    },
    {
      enabled: widget.data?.mainTicker?.symbol !== null,
      staleTime: 1000 * 60 * 60 * 24 * 7,
    },
  );

  const overviewElement = useMemo(() => {
    const overviewData = overviewQuery?.results;
    return (
      <div className="flex gap-2 _widget-content">
        {overviewData?.results?.mkt_cap && (
          <>
            <p>
              Market Cap:{" "}
              <span className="font-medium">{formatNumber(overviewData?.mkt_cap)}</span>
            </p>
            |
          </>
        )}
        {faShares?.results?.[0]?.outstanding_shares && (
          <p>
            Outstanding Shares:{" "}
            <span className="font-medium">
              {formatNumber(faShares?.results?.[0]?.outstanding_shares)}
            </span>
          </p>
        )}
      </div>
    );
  }, [overviewQuery?.results?.mkt_cap, faShares?.results?.[0]?.outstanding_shares]);

  return { dataUpdatedAt, isLoading, overviewElement };
}

export default function PricePerformance() {
  const { dataUpdatedAt, isLoading, overviewElement } = useOverviewData();
  const elementRightNextToTitle = useMemo(
    () => <AdvancedSelectedTicker triggerSize="sm" ignoreTypes={["index"]} />,
    [],
  );

  return (
    <DraggableCard
      lastUpdated={dataUpdatedAt}
      extraClassName="overflow-y-hidden"
      title="Price Performance"
      elementRightNextToTitle={elementRightNextToTitle}
      loading={isLoading}
    >
      {overviewElement}
      <div className="min-h-[300px] h-full">
        <TVChartUnavailable message="Connect an Advanced Charts widget to a UDF-compatible datafeed to view prices." />
      </div>
    </DraggableCard>
  );
}
