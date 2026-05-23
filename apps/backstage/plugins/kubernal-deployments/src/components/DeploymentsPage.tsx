import React from "react";
import { Grid } from "@material-ui/core";
import {
  Page,
  Header,
  Content,
  Progress,
  ResponseErrorPanel,
  Table,
  StatusOK,
  StatusError,
  StatusWarning,
  StatusAborted,
  StatusRunning,
} from "@backstage/core-components";
import { useApi } from "@backstage/core-plugin-api";
import { kubernalDeploymentsApiRef } from "../api";

import useAsync from "react-use/lib/useAsync";
const statusIcon = (status: string) => {
  switch (status) {
    case "healthy":
      return <StatusOK />;
    case "failed":
      return <StatusError />;
    case "building":
    case "deploying":
      return <StatusRunning />;
    case "pending":
      return <StatusWarning />;
    case "cancelled":
    case "rolled_back":
      return <StatusAborted />;
    default:
      return <StatusWarning />;
  }
};

export const DeploymentsPage = () => {
  const api = useApi(kubernalDeploymentsApiRef);

  const { value, loading, error } = useAsync(
    () => api.getDeployments(),
    [],
  );

  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;

  const columns = [
    { title: "Status", field: "status", render: (row: { status: string }) => statusIcon(row.status) },
    { title: "Application", field: "applicationId" },
    { title: "Version", field: "version" },
    { title: "Trigger", field: "trigger" },
    { title: "Created", field: "createdAt" },
  ];

  return (
    <Page themeId="tool">
      <Header title="Deployments" subtitle="All deployments across all applications" />
      <Content>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Table
              options={{ search: true, paging: true, pageSize: 20 }}
              columns={columns}
              data={value ?? []}
            />
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
