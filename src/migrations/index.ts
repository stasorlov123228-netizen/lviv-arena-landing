import * as migration_20261018000000_initial_payload_schema from './20261018000000_initial_payload_schema';
import * as migration_20261019140000_booking_computer_overlap from './20261019140000_booking_computer_overlap';
import * as migration_20261020200000_auth_roles_computers_tariffs from './20261020200000_auth_roles_computers_tariffs';
import * as migration_20261024165000_seed_default_tariffs from './20261024165000_seed_default_tariffs';
import * as migration_20261024120000_customer_payments from './20261024120000_customer_payments';
import * as migration_20261024150000_inquiries_payment_paid_flag from './20261024150000_inquiries_payment_paid_flag';
import * as migration_20261024160000_booking_user_relation from './20261024160000_booking_user_relation';
import * as migration_20261024170000_tariff_hourly_prices from './20261024170000_tariff_hourly_prices';
import * as migration_20261026100000_payment_booking_fk from './20261026100000_payment_booking_fk';
import * as migration_20261026110000_media_storage_prefix from './20261026110000_media_storage_prefix';
import * as migration_20261026120000_booking_email_unique_accounts from './20261026120000_booking_email_unique_accounts';
import * as migration_20261027130000_custom_tariff_codes from './20261027130000_custom_tariff_codes';

export const migrations = [
  {
    up: migration_20261018000000_initial_payload_schema.up,
    down: migration_20261018000000_initial_payload_schema.down,
    name: '20261018000000_initial_payload_schema',
  },
  {
    up: migration_20261019140000_booking_computer_overlap.up,
    down: migration_20261019140000_booking_computer_overlap.down,
    name: '20261019140000_booking_computer_overlap',
  },
  {
    up: migration_20261020200000_auth_roles_computers_tariffs.up,
    down: migration_20261020200000_auth_roles_computers_tariffs.down,
    name: '20261020200000_auth_roles_computers_tariffs',
  },
  {
    up: migration_20261024120000_customer_payments.up,
    down: migration_20261024120000_customer_payments.down,
    name: '20261024120000_customer_payments',
  },
  {
    up: migration_20261024150000_inquiries_payment_paid_flag.up,
    down: migration_20261024150000_inquiries_payment_paid_flag.down,
    name: '20261024150000_inquiries_payment_paid_flag',
  },
  {
    up: migration_20261024160000_booking_user_relation.up,
    down: migration_20261024160000_booking_user_relation.down,
    name: '20261024160000_booking_user_relation',
  },
  {
    up: migration_20261024165000_seed_default_tariffs.up,
    down: migration_20261024165000_seed_default_tariffs.down,
    name: '20261024165000_seed_default_tariffs',
  },
  {
    up: migration_20261024170000_tariff_hourly_prices.up,
    down: migration_20261024170000_tariff_hourly_prices.down,
    name: '20261024170000_tariff_hourly_prices'
  },
  {
    up: migration_20261026100000_payment_booking_fk.up,
    down: migration_20261026100000_payment_booking_fk.down,
    name: '20261026100000_payment_booking_fk',
  },
  {
    up: migration_20261026110000_media_storage_prefix.up,
    down: migration_20261026110000_media_storage_prefix.down,
    name: '20261026110000_media_storage_prefix',
  },
  {
    up: migration_20261026120000_booking_email_unique_accounts.up,
    down: migration_20261026120000_booking_email_unique_accounts.down,
    name: '20261026120000_booking_email_unique_accounts',
  },
  {
    up: migration_20261027130000_custom_tariff_codes.up,
    down: migration_20261027130000_custom_tariff_codes.down,
    name: '20261027130000_custom_tariff_codes',
  },
];
