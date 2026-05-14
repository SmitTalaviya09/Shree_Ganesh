public without sharing class JwelAuthController {

    public class UserResult {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String  message;
        @AuraEnabled public String  userId;
        @AuraEnabled public String  fullName;
        @AuraEnabled public String  role;
        @AuraEnabled public String  loginId;
    }

    @AuraEnabled
    public static UserResult login(String loginId, String password) {
        UserResult res = new UserResult();
        try {
            if (String.isBlank(loginId) || String.isBlank(password)) {
                res.success = false;
                res.message = 'Login ID and Password are required.';
                return res;
            }

            List<JwelUser__c> users = [
                SELECT Id, Name, Login_ID__c, Password__c, Role__c, Is_Active__c
                FROM JwelUser__c
                WHERE Login_ID__c = :loginId.trim()
                AND   Password__c = :password
                LIMIT 1
            ];

            if (users.isEmpty()) {
                res.success = false;
                res.message = 'Invalid Login ID or Password.';
                return res;
            }

            JwelUser__c u = users[0];

            if (!u.Is_Active__c) {
                res.success = false;
                res.message = 'Your account has been deactivated. Please contact the administrator.';
                return res;
            }

            // Update last login timestamp
            u.Last_Login__c = System.now();
            update u;

            res.success  = true;
            res.message  = 'Login successful';
            res.userId   = u.Id;
            res.fullName = u.Name;
            res.role     = u.Role__c;
            res.loginId  = u.Login_ID__c;
            return res;

        } catch (Exception ex) {
            res.success = false;
            res.message = 'System error: ' + ex.getMessage();
            return res;
        }
    }

    // Admin method to create a new user (Manager use only)
    @AuraEnabled
    public static UserResult createUser(String fullName, String loginId, String password, String role) {
        UserResult res = new UserResult();
        try {
            if (String.isBlank(fullName) || String.isBlank(loginId) || String.isBlank(password) || String.isBlank(role)) {
                res.success = false;
                res.message = 'All fields are required.';
                return res;
            }

            // Check duplicate login ID
            List<JwelUser__c> existing = [
                SELECT Id FROM JwelUser__c WHERE Login_ID__c = :loginId.trim() LIMIT 1
            ];
            if (!existing.isEmpty()) {
                res.success = false;
                res.message = 'Login ID already exists. Choose a different one.';
                return res;
            }

            JwelUser__c newUser = new JwelUser__c(
                Name       = fullName,
                Login_ID__c = loginId.trim(),
                Password__c = password,
                Role__c    = role,
                Is_Active__c = true
            );
            insert newUser;

            res.success  = true;
            res.message  = 'User created successfully.';
            res.userId   = newUser.Id;
            res.fullName = fullName;
            res.role     = role;
            res.loginId  = loginId.trim();
            return res;

        } catch (Exception ex) {
            res.success = false;
            res.message = 'Error creating user: ' + ex.getMessage();
            return res;
        }
    }

    // Get all users (Manager only)
    @AuraEnabled
    public static List<JwelUser__c> getAllUsers() {
        return [
            SELECT Id, Name, Login_ID__c, Role__c, Is_Active__c, Last_Login__c
            FROM JwelUser__c
            ORDER BY CreatedDate DESC
        ];
    }

    // Toggle active/inactive
    @AuraEnabled
    public static Boolean toggleUserActive(String userId, Boolean isActive) {
        try {
            JwelUser__c u = [SELECT Id, Is_Active__c FROM JwelUser__c WHERE Id = :userId LIMIT 1];
            u.Is_Active__c = isActive;
            update u;
            return true;
        } catch (Exception ex) {
            return false;
        }
    }
}