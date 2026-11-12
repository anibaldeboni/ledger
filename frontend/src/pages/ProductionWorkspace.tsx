import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import ProductionArchive from "./ProductionArchive";
import ProductionBoard from "./ProductionBoard";
import ProductionReports from "./ProductionReports";

export default function ProductionWorkspace() {
  const { t } = useTranslation();

  return (
    <Tabs defaultValue="board" className="production-workspace">
      <TabsList variant="line" aria-label={t("production.viewTabs")}>
        <TabsTrigger value="board">{t("production.boardTab")}</TabsTrigger>
        <TabsTrigger value="archive">{t("production.archiveTab")}</TabsTrigger>
        <TabsTrigger value="reports">{t("production.reportsTab")}</TabsTrigger>
      </TabsList>
      <TabsContent value="board"><ProductionBoard /></TabsContent>
      <TabsContent value="archive"><ProductionArchive /></TabsContent>
      <TabsContent value="reports"><ProductionReports /></TabsContent>
    </Tabs>
  );
}
