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
import { t } from '@superset-ui/core';
import { Menu } from '@superset-ui/core/components/Menu';
import DownloadAsExcel from '../menu/DownloadMenuItems/DownloadAsExcel';

const HeaderActionsDropdown = ({ dashboardTitle }: { dashboardTitle: string }) => {
  const menuItems = [
    {
      key: 'download-as-excel',
      label: t('Download as Excel'),
      children: [
        {
          key: 'download-as-new-excel',
          label: <DownloadAsExcel 
            text={t('Create new Excel file')} 
            dashboardTitle={dashboardTitle}
            useTemplate={false}
          />,
        },
        {
          key: 'download-as-template-excel',
          label: <DownloadAsExcel 
            text={t('Use Excel template')} 
            dashboardTitle={dashboardTitle}
            useTemplate={true}
          />,
        },
      ],
    },
    // Add other menu items here
  ];

  return <Menu mode="horizontal" items={menuItems} />;
};

export default HeaderActionsDropdown;
