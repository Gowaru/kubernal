import React from "react";
import { useEntity } from "@backstage/plugin-catalog-react";
import {
  InfoCard,
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
import { kubernalDeploymentsApiRef } from "../api.js";
import useAsync from "react-use/lib/useAsync.js";

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

export const DeploymentsCard = () => {
  const { entity } = useEntity();
  const api = useApi(kubernalDeploymentsApiRef);
  const appName = entity.metadata.name;

  const { value, loading, error } = useAsync(async () => {
    const allDeployments = await api.getDeployments();
    return allDeployments.filter((d) => d.applicationId === appName);
  }, [appName]);

  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;

  const columns = [
    { title: "Status", field: "status", render: (row: { status: string }) => statusIcon(row.status) },
    { title: "Version", field: "version" },
    { title: "Environment", field: "environmentId" },
    { title: "Trigger", field: "trigger" },
    { title: "Started", field: "startedAt" },
  ];

  return (
    <InfoCard title="Deployments" subheader={`Last 10 deployments for ${appName}`}>
      <Table
        options={{ search: false, paging: false, pageSize: 10 }}
        columns={columns}
        data={value ?? []}
      />
    </InfoCard>
  );
};
