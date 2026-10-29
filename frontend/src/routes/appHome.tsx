import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Button } from "~/components/ds/atoms/Button";
import Icon from "~/components/Icon";
import { SettingsLayout } from "~/components/LayoutAuth/Skeleton/SettingsLayout";
import { getConfig } from "~/lib/runtimeConfig";

const uiShowExternalDocumentationLinksFF = getConfig().ui.showExternalDocLinks;

export default function MenuHomePage() {
  return (
    <SettingsLayout title="Help and Documentation" tabs={[]} defaultTab="help">
      <TabsPrimitive.Content
        value="help"
        className="p-6 text-sm only-sm:h-screen flex flex-col flex-1 h-[calc(100vh-72px)]"
      >
        {uiShowExternalDocumentationLinksFF && (
          <div className="flex w-full flex-col gap-2.5 dark:bg-dark-900 rounded-lg bg-white p-4">
            <div className="inline-flex items-center gap-2 body-sm-bold dark:text-light-100 text-black">
              <div className="rounded-sm dark:bg-transparent size-6 bg-light-100 flex items-center justify-center">
                <Icon
                  id="book-open-01"
                  className="size-4 dark:text-brand-lighter text-brand-main"
                />
              </div>
              Workspace Documentation
            </div>
            <p className="body-xs-regular dark:text-light-100 text-light-800 mb-1.5">
              Access technical specifications for building custom data widgets,
              integrating AI agents, configuring role-based access controls, and much
              more.
            </p>
            <a
              href="https://docs.openbb.co/workspace"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-auto"
            >
              <Button className="w-fit" size="sm">
                Read Documentation
                <Icon id="external-link-icon" className="size-4" />
              </Button>
            </a>
          </div>
        )}
      </TabsPrimitive.Content>
    </SettingsLayout>
  );
}
