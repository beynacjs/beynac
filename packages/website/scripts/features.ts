import { feature, type Feature } from "./port-utils.js";

export const features: Feature[] = [
  feature("IoC Container", "Container/**"),
  feature("View", ["View/**", "tests/View/**"]),
  feature("Validation", ["Validation/**", "tests/Validation/**"]),

  feature(
    "Routing",
    ["Routing/**", "tests/Routing/**"],
    feature("Make controller/middleware commands", "Routing/Console/**"),
  ),

  feature("Auth", ["Auth/**", "tests/Auth/**"]),
  feature("Config", ["Config/**", "tests/Config/**"]),
  feature("Console", [
    "Console/**",
    "Contracts/Console/**",
    "tests/Console/**",
    "tests/Integration/Console/**",
  ]),

  feature("Broadcasting", ["Broadcasting/**", "tests/Broadcasting/**"]),

  feature("Queue", ["Queue/**", "tests/Queue/**", "Bus/**", "tests/Bus/**"]),

  feature(
    "Cache",
    ["Cache/**", "tests/Cache/**"],
    feature("Redis backend", ["Cache/**/*Redis*", "tests/Cache/*Redis*"]),
    feature("Memcached backend", ["Cache/**/*Memcached*", "tests/Cache/*Memcached*"]),
    feature("Console API", ["Cache/Console/**"]),
    feature("Rate Limiting", [
      "Cache/RateLimiter.php",
      "Cache/RateLimiting/**",
      "tests/Cache/CacheRateLimiterTest.php",
    ]),
  ),

  feature("Collections", [
    "Collections/**",
    "**/Conditionable/**",
    "**/SupportConditionableTest.php",
  ]),

  feature("Console", ["Filesystem/**", "tests/Filesystem/**"]),

  feature(
    "Database",
    [],
    feature("Query Builder", "Database/Query/**"),
    feature("Eloquent ORM", "Database/Eloquent/**"),
    feature("Database Migrations", [
      "Database/Migrations/**",
      "Database/Migration*",
      "Database/Console/Migrations/**",
      "Contracts/Database/Events/MigrationEvent.php",
      "Database/Events/*Migration*",
      "Foundation/Testing/DatabaseMigrations.php",
      "Foundation/Testing/Traits/CanConfigureMigrationCommands.php",
      "tests/Database/DatabaseMigration*",
      "tests/Database/stubs/Migration*",
      "tests/Foundation/Testing/DatabaseMigrationsTest.php",
      "tests/Foundation/Testing/Traits/CanConfigureMigrationCommandsTest.php",
      "tests/Integration/Database/MigrationServiceProviderTest.php",
      "tests/Integration/Migration/**",
    ]),
  ),

  feature("Concurrency", ["**/Concurrency/**", "Support/Facades/Concurrency.php"]),
];
