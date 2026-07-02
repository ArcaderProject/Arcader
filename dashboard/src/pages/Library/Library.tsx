import {
    Tabs,
    TabsContent,
    TabsTrigger,
    TabsTriggerList,
    TabsPanels,
} from "@/components/retroui/Tab";
import { Games } from "@/pages/Games/Games";
import { Apps } from "@/pages/Apps/Apps";

export const Library = () => {
    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            <Tabs>
                <TabsTriggerList className="mb-2">
                    <TabsTrigger>GAMES</TabsTrigger>
                    <TabsTrigger>APPS</TabsTrigger>
                </TabsTriggerList>
                <TabsPanels>
                    <TabsContent>
                        <Games embedded />
                    </TabsContent>
                    <TabsContent>
                        <Apps embedded />
                    </TabsContent>
                </TabsPanels>
            </Tabs>
        </div>
    );
};
