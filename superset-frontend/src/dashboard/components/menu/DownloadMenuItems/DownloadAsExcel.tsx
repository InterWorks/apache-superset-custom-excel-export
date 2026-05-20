/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useRef, ChangeEvent } from 'react';
import { logging, t, SupersetClient } from '@superset-ui/core';
import { Menu } from '@superset-ui/core/components/Menu';
import { useSelector } from 'react-redux';
import { LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_EXCEL } from 'src/logger/LogUtils';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { buildDashboardExportPayload } from 'src/explore/exploreUtils';
import { RootState } from 'src/dashboard/types';
import getFormDataWithExtraFilters from 'src/dashboard/util/charts/getFormDataWithExtraFilters';
import { getAppliedFilterValues } from 'src/dashboard/util/activeDashboardFilters';
import { enforceSharedLabelsColorsArray } from 'src/utils/colorScheme';

export default function DownloadAsExcel({
  text,
  logEvent,
  dashboardTitle,
  useTemplate = false,
  ...props
}: {
  text: string;
  dashboardTitle: string;
  logEvent?: Function;
  useTemplate?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addDangerToast } = useToasts();
  const charts = useSelector((state: RootState) => state.charts);
  const dashboardId = useSelector((state: RootState) => state.dashboardInfo?.id);
  const dashboardInfo = useSelector((state: RootState) => state.dashboardInfo);
  const chartConfiguration = useSelector((state: RootState) => state.dashboardInfo.metadata?.chart_configuration);
  const labelsColor = useSelector((state: RootState) => state.dashboardInfo?.metadata?.label_colors || {});
  const labelsColorMap = useSelector((state: RootState) => state.dashboardInfo?.metadata?.map_label_colors || {});
  const sharedLabelsColors = useSelector((state: RootState) => 
    enforceSharedLabelsColorsArray(state.dashboardInfo?.metadata?.shared_label_colors)
  );
  const allSliceIds = useSelector((state: RootState) => state.dashboardState.sliceIds);
  const nativeFilters = useSelector((state: RootState) => state.nativeFilters?.filters);
  const dataMask = useSelector((state: RootState) => state.dataMask);

  const handleTemplateFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      addDangerToast(t('Please select a valid Excel file'));
      return;
    }

    await performDownload(file);
  };

  const performDownload = async (templateFile?: File) => {
    
    const createFormData = async (chart: any) => {
      // Use the same function as single chart export to get form data with filters
      const formData = getFormDataWithExtraFilters({
        chart: chart as any, // Cast needed for type compatibility
        chartConfiguration,
        filters: getAppliedFilterValues(chart.form_data.slice_id),
        colorScheme: dashboardInfo.metadata?.color_scheme,
        colorNamespace: dashboardInfo.metadata?.color_namespace,
        sliceId: chart.form_data.slice_id,
        nativeFilters,
        dataMask,
        allSliceIds,
        extraControls: {},
        labelsColor,
        labelsColorMap,
        sharedLabelsColors,
      });
      
      return formData;
    };
    try {
      // Get form data for each chart on the dashboard
      // const rawChartQueries = Object.values(charts).map(chart => {
      const rawChartQueries = await Promise.all(Object.values(charts).map(async chart => {
        // Make sure we have all the data we need and valid form data
        if (!chart.form_data) return null;

        // Get filters that apply to this chart
        const appliedFilters = getAppliedFilterValues(chart.form_data.slice_id);
        
        // Get form data with native filters key
        const formData = await createFormData(chart);


        return {
          formData,
          query_context: {
            datasource: chart.form_data.datasource,
            force: false,
            result_format: 'json',
            result_type: 'full',
            queries: [{
              ...formData,
              is_retrieving: true,
              datasource: chart.form_data.datasource,
              filters: appliedFilters,
            }],
          },
          slice_name: (chart as any).slice_name || 'Unnamed Chart',
          viz_type: chart.form_data.viz_type,
          datasource: chart.form_data.datasource,
          slice_id: chart.form_data.slice_id,
        };
      })).then(results => results.filter(Boolean));

      if (rawChartQueries.length === 0) {
        addDangerToast(t('No charts found on this dashboard'));
        return;
      }

      // Build query contexts using the utility function
      const payload = buildDashboardExportPayload({
        queries: rawChartQueries,
        force: false,
        resultFormat: 'xlsx',
        resultType: 'full',
      });

      if (!dashboardId) {
        addDangerToast(t('Dashboard ID is required for export'));
        return;
      }

      // Call the dashboard charts export endpoint
      let response;
      const endpoint = `/api/v1/dashboard/${dashboardId}/export_charts_data/`;
      
      if (templateFile) {
        const formData = new FormData();
        formData.append('template', templateFile);
        formData.append('payload', JSON.stringify(payload));
        
        response = await SupersetClient.post({
          endpoint,
          body: formData,
          parseMethod: 'raw',
        });
      } else {
        response = await SupersetClient.post({
          endpoint,
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' },
          parseMethod: 'raw',
        });
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dashboardTitle}_charts.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      logEvent?.(LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_EXCEL);

    } catch (error) {
      logging.error(error);
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
  };

  return (
    <>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleTemplateFileSelected}
        ref={fileInputRef}
        style={{ display: 'none' }}
      />
      <Menu.Item
        key="download-excel"
        onClick={() => {
          if (useTemplate) {
            fileInputRef.current?.click();
          } else {
            performDownload();
          }
        }}
        {...props}
      >
        {text}
      </Menu.Item>
    </>
  );
}
