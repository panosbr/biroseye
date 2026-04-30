// Custom Expo config plugin που προσθέτει network_security_config.xml
// επιτρέποντας ρητά cleartext HTTP σε LAN + Tailscale IPs.
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const NETWORK_SECURITY_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">192.168.1.5</domain>
        <domain includeSubdomains="true">100.76.147.120</domain>
        <domain includeSubdomains="true">photodrama.synology.me</domain>
    </domain-config>
</network-security-config>
`;

const withNetworkSecurityConfig = (config) => {
  // 1. Γράψε το XML στο android/app/src/main/res/xml/network_security_config.xml
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const xmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'res', 'xml'
      );
      if (!fs.existsSync(xmlDir)) fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'network_security_config.xml'),
        NETWORK_SECURITY_XML
      );
      return cfg;
    },
  ]);

  // 2. Πρόσθεσε το attribute στο <application> tag του AndroidManifest
  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    app.$['android:usesCleartextTraffic'] = 'true';
    return cfg;
  });

  return config;
};

module.exports = withNetworkSecurityConfig;
