import React from "react";

import ConnectionPage from "../../../../components/modules/day-book/data-sources/ConnectionPage";
import FtpForm from "../../../../components/layout/forms/FtpForm";
import {
  validateFtpForm,
  generateFtpNameFromHostname,
  buildFtpConnectionData,
} from "../../../../utils/connectionValidators";
import { createCustomFtpAdapter } from "../ftpAdapter";

const FtpConnectionScreen = () => (
  <ConnectionPage
    connectionType="custom-ftp"
    title="Custom FTP"
    createAdapter={createCustomFtpAdapter}
    FormComponent={FtpForm}
    formValidator={validateFtpForm}
    connectionDataBuilder={buildFtpConnectionData}
    nameGenerator={generateFtpNameFromHostname}
  />
);

export default FtpConnectionScreen;
