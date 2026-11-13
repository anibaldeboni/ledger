import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import ProductionArchive from "./ProductionArchive";
import ProductionBoard from "./ProductionBoard";
import ProductionReports from "./ProductionReports";
import ProductionSettings from "./ProductionSettings";

export default function ProductionWorkspace() {
  const { t } = useTranslation();

  return (
    <Tabs defaultValue="board" className="production-workspace">
      <TabsList variant="line" aria-label={t("production.viewTabs")}>
        <TabsTrigger value="board">{t("production.boardTab")}</TabsTrigger>
        <TabsTrigger value="archive">{t("production.archiveTab")}</TabsTrigger>
        <TabsTrigger value="reports">{t("production.reportsTab")}</TabsTrigger>
        <TabsTrigger value="settings">{t("settings.title")}</TabsTrigger>
      </TabsList>
      <TabsContent value="board"><ProductionBoard /></TabsContent>
      <TabsContent value="archive"><ProductionArchive /></TabsContent>
      <TabsContent value="reports"><ProductionReports /></TabsContent>
      <TabsContent value="settings"><ProductionSettings /></TabsContent>
    </Tabs>
  );
}
