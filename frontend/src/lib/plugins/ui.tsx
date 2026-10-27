import type { WidgetShellProps } from "@piiq/workspace-plugin-sdk";
import { type SVGAttributes, useMemo } from "react";
import { downloadData } from "~/components/Charting/utils";
import DraggableCard, { SetLoadingOnResize } from "~/components/DraggableCard";
import { useWidgetParamsPositions } from "~/components/General/Table/NavBar/QueryParams";
import Icon from "~/components/Icon";
import type { IconId } from "~/components/Icon.types";

export function PluginIcon(props: SVGAttributes<SVGSVGElement> & { id: string }) {
  return <Icon {...props} id={props.id as IconId} />;
}

export function PluginWidgetShell({
  children,
  toolbar,
  data,
  ...props
}: WidgetShellProps) {
  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();
  const exportFns = useMemo(
    () =>
      Array.isArray(data) && data.length > 0
        ? {
            csvFunction: (title: string) => {
              void downloadData(data, title, "csv", false);
            },
            excelFunction: (title: string) => {
              void downloadData(data, title, "excel", false);
            },
          }
        : undefined,
    [data],
  );
  return (
    <DraggableCard
      {...props}
      aiData={data}
      aiEnabled={true}
      exportFns={exportFns}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      extraNavbarElements={toolbar}
    >
      <SetLoadingOnResize>{children}</SetLoadingOnResize>
    </DraggableCard>
  );
}
