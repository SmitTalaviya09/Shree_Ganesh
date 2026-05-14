/*public class GoogleDriveJWT {
    public static String getAccessToken() {
        Google_Drive_Config__mdt cfg = [
            SELECT Private_Key__c, Client_Email__c 
            FROM Google_Drive_Config__mdt LIMIT 1
        ];
        
        Long now = DateTime.now().getTime() / 1000;
        String header = JSON.serialize(new Map<String,String>{
            'alg'=>'RS256','typ'=>'JWT'
        });
        String claim = JSON.serialize(new Map<String,Object>{
            'iss'   => cfg.Client_Email__c,
            'scope' => 'https://www.googleapis.com/auth/drive.file',
            'aud'   => 'https://oauth2.googleapis.com/token',
            'exp'   => now + 3600,
            'iat'   => now
        });
        
        String b64Header = EncodingUtil.base64Encode(Blob.valueOf(header))
                            .replace('+','-').replace('/','_').replace('=','');
        String b64Claim  = EncodingUtil.base64Encode(Blob.valueOf(claim))
                            .replace('+','-').replace('/','_').replace('=','');
        String sigInput  = b64Header + '.' + b64Claim;
        
        Blob privateKeyBlob = EncodingUtil.base64Decode(
            cfg.Private_Key__c
               .replace('-----BEGIN RSA PRIVATE KEY-----','')
               .replace('-----END RSA PRIVATE KEY-----','')
               .replace('\n','').trim()
        );
        Blob signed = Crypto.sign('RSA-SHA256', Blob.valueOf(sigInput), privateKeyBlob);
        String b64Sig = EncodingUtil.base64Encode(signed)
                        .replace('+','-').replace('/','_').replace('=','');
        
        String jwt = sigInput + '.' + b64Sig;
        
        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://oauth2.googleapis.com/token');
        req.setMethod('POST');
        req.setHeader('Content-Type','application/x-www-form-urlencoded');
        req.setBody('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt);
        
        Http h = new Http();
        HttpResponse res = h.send(req);
        Map<String,Object> parsed = (Map<String,Object>) JSON.deserializeUntyped(res.getBody());
        return (String) parsed.get('access_token');
    }
}*/
public class GoogleDriveJWT {
    public static String getAccessToken() {
        Google_Drive_Config__mdt cfg = [
            SELECT Private_Key__c, Client_Email__c 
            FROM Google_Drive_Config__mdt LIMIT 1
        ];
        
        Long now = DateTime.now().getTime() / 1000;
        String header = JSON.serialize(new Map<String,String>{
            'alg'=>'RS256','typ'=>'JWT'
        });
        String claim = JSON.serialize(new Map<String,Object>{
            'iss'   => cfg.Client_Email__c,
            'scope' => 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
            'aud'   => 'https://oauth2.googleapis.com/token',
            'exp'   => now + 3600,
            'iat'   => now
        });
        
        String b64Header = EncodingUtil.base64Encode(Blob.valueOf(header))
                            .replace('+','-').replace('/','_').replace('=','');
        String b64Claim  = EncodingUtil.base64Encode(Blob.valueOf(claim))
                            .replace('+','-').replace('/','_').replace('=','');
        String sigInput  = b64Header + '.' + b64Claim;
        
        String rawKey = cfg.Private_Key__c;
        rawKey = rawKey.replace('-----BEGIN PRIVATE KEY-----', '');
        rawKey = rawKey.replace('-----END PRIVATE KEY-----', '');
        rawKey = rawKey.replace('-----BEGIN RSA PRIVATE KEY-----', '');
        rawKey = rawKey.replace('-----END RSA PRIVATE KEY-----', '');
        rawKey = rawKey.replace('\\n', '');
        rawKey = rawKey.replace('\n', '');
        rawKey = rawKey.replace('\r', '');
        rawKey = rawKey.replace(' ', '');
        rawKey = rawKey.trim();
        
        Blob privateKeyBlob = EncodingUtil.base64Decode(rawKey);
        Blob signed = Crypto.sign('RSA-SHA256', Blob.valueOf(sigInput), privateKeyBlob);
        String b64Sig = EncodingUtil.base64Encode(signed)
                        .replace('+','-').replace('/','_').replace('=','');
        
        String jwt = sigInput + '.' + b64Sig;
        
        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://oauth2.googleapis.com/token');
        req.setMethod('POST');
        req.setHeader('Content-Type','application/x-www-form-urlencoded');
        req.setBody('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt);
        
        Http h = new Http();
        HttpResponse res = h.send(req);
        Map<String,Object> parsed = (Map<String,Object>) JSON.deserializeUntyped(res.getBody());
        return (String) parsed.get('access_token');
    }
}