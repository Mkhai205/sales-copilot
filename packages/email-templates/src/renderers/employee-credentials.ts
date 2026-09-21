import { render } from '@react-email/render';
import * as React from 'react';
import {
  EmployeeCredentialsEmail,
  EmployeeCredentialsProps,
} from '../templates/EmployeeCredentials';

export async function renderEmployeeCredentialsEmail(
  props: EmployeeCredentialsProps,
): Promise<string> {
  return render(React.createElement(EmployeeCredentialsEmail, props));
}
