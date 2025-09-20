const SwaggerParser = require('swagger-parser');
const fs = require('fs');
const path = require('path');

const SWAGGER_YAML = path.join(__dirname, '..', 'swagger.yaml');
const SWAGGER_JSON = path.join(__dirname, '..', 'swagger.json');

async function validateSwagger() {
  try {
    console.log('🔍 Validating OpenAPI specification...');
    await SwaggerParser.validate(SWAGGER_YAML);
    console.log('✅ OpenAPI specification is valid!');
    return true;
  } catch (err) {
    console.error('❌ OpenAPI specification validation failed:');
    console.error(err.message);
    return false;
  }
}

async function convertToJson() {
  try {
    console.log('🔄 Converting YAML to JSON...');
    const api = await SwaggerParser.parse(SWAGGER_YAML);
    fs.writeFileSync(SWAGGER_JSON, JSON.stringify(api, null, 2));
    console.log('✅ swagger.json created successfully!');
    return true;
  } catch (err) {
    console.error('❌ Conversion failed:');
    console.error(err.message);
    return false;
  }
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'validate':
      const isValid = await validateSwagger();
      process.exit(isValid ? 0 : 1);
      break;

    case 'json':
      const validForConversion = await validateSwagger();
      if (!validForConversion) {
        console.error('❌ Cannot convert invalid YAML to JSON');
        process.exit(1);
      }
      const converted = await convertToJson();
      process.exit(converted ? 0 : 1);
      break;

    case 'build':
      console.log('🚀 Building Swagger documentation...');
      const validForBuild = await validateSwagger();
      if (!validForBuild) {
        process.exit(1);
      }
      const buildSuccess = await convertToJson();
      if (buildSuccess) {
        console.log('🎉 Swagger documentation built successfully!');
        console.log('📁 Files created:');
        console.log('   - swagger.yaml (OpenAPI 3.0 YAML format)');
        console.log('   - swagger.json (OpenAPI 3.0 JSON format)');
      }
      process.exit(buildSuccess ? 0 : 1);
      break;

    default:
      console.log('🔧 Cemetery CRM - Swagger Management Tool');
      console.log('');
      console.log('Usage:');
      console.log('  npm run swagger:validate  - Validate OpenAPI specification');
      console.log('  npm run swagger:json      - Convert YAML to JSON format');
      console.log('  npm run swagger:build     - Build both YAML and JSON docs');
      console.log('');
      console.log('Available commands:');
      console.log('  validate   Validate the OpenAPI specification');
      console.log('  json       Convert YAML to JSON format');
      console.log('  build      Validate and build all formats');
      break;
  }
}

main().catch(console.error);