import React from "react";

import ConnectionPage from "../../../../components/modules/day-book/data-sources/ConnectionPage";
import ApiForm from "../../../../components/layout/forms/ApiForm";
import {
  validateApiForm,
  generateApiNameFromUrl,
  buildApiConnectionData,
} from "../../../../utils/connectionValidators";
import { createCustomApiAdapter } from "../apiAdapter";

const ApiConnectionScreen = () => (
  <ConnectionPage
    connectionType="custom-api"
    title="Custom API"
    createAdapter={createCustomApiAdapter}
    FormComponent={ApiForm}
    formValidator={validateApiForm}
    connectionDataBuilder={buildApiConnectionData}
    nameGenerator={generateApiNameFromUrl}
  />
);

export default ApiConnectionScreen;
