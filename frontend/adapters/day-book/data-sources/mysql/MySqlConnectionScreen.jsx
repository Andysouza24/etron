import React from "react";

import ConnectionPage from "../../../../components/modules/day-book/data-sources/ConnectionPage";
import MySqlForm from "../../../../components/layout/forms/MySqlForm";
import {
  validateMySqlForm,
  generateMySqlNameFromHostname,
  buildMySqlConnectionData,
} from "../../../../utils/connectionValidators";
import { createMySqlAdapter } from "../mySqlAdapter";

const MySqlConnectionScreen = () => (
  <ConnectionPage
    connectionType="mysql"
    title="MySQL Database"
    createAdapter={createMySqlAdapter}
    FormComponent={MySqlForm}
    formValidator={validateMySqlForm}
    connectionDataBuilder={buildMySqlConnectionData}
    nameGenerator={generateMySqlNameFromHostname}
  />
);

export default MySqlConnectionScreen;
