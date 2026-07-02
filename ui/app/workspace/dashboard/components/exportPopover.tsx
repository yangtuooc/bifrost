import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdownMenu";
import { buildCSV, downloadCSV } from "@/lib/utils/csv";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { type DashboardData, getCSVSections } from "../utils/exportUtils";

interface ExportPopoverProps {
	getData: () => DashboardData;
	onPreloadData: () => Promise<void>;
	onPdfExport: () => Promise<HTMLElement[]>;
	onPdfExportDone: () => void;
}

export function ExportPopover({ getData, onPreloadData, onPdfExport, onPdfExportDone }: ExportPopoverProps) {
	const { t } = useTranslation();
	const [exporting, setExporting] = useState(false);

	const handleCsvExport = useCallback(async () => {
		setExporting(true);
		try {
			await onPreloadData();
			const sections = getCSVSections(getData(), "all");
			const parts: string[] = [];
			for (const section of sections) {
				if (section.csv.rows.length === 0) continue;
				parts.push(`# ${section.name}`);
				parts.push(buildCSV(section.csv.headers, section.csv.rows));
				parts.push("");
			}
			if (parts.length > 0) {
				downloadCSV(parts.join("\n"), "dashboard-export");
			}
		} finally {
			setExporting(false);
		}
	}, [getData, onPreloadData]);

	const handlePdfExport = useCallback(async () => {
		setExporting(true);

		// Yield a frame so the spinner renders before heavy work starts
		await new Promise((r) => requestAnimationFrame(r));

		try {
			const { generatePdf } = await import("@/lib/utils/pdf");

			const elements = await onPdfExport();
			const pdfTabLabels = [
				t("dashboard.tabs.overview"),
				t("dashboard.tabs.providerUsage"),
				t("dashboard.tabs.modelRankings"),
				t("dashboard.tabs.mcpUsage"),
			];

			const sections = elements.map((element, i) => ({
				element,
				label: pdfTabLabels[i],
			}));

			await generatePdf(sections, "dashboard-export", {
				branding: {
					logoSrc: "/bifrost-logo.webp",
					text: t("dashboard.export.poweredBy"),
				},
			});
		} finally {
			onPdfExportDone();
			setExporting(false);
		}
	}, [onPdfExport, onPdfExportDone, t]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="default" disabled={exporting} data-testid="dashboard-export-trigger">
					{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
					{exporting ? t("dashboard.export.exporting") : t("common.actions.export")}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={handleCsvExport} data-testid="export-csv-item">
					<FileSpreadsheet className="h-4 w-4" />
					CSV
				</DropdownMenuItem>
				<DropdownMenuItem onClick={handlePdfExport} data-testid="export-pdf-item">
					<FileText className="h-4 w-4" />
					PDF
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}