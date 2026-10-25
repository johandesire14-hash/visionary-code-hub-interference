# Mode gratuit global temporaire — fonctionnement et retrait

## Fonctionnement

Le drapeau `TEMPORARY_FREE_ACCESS_ENABLED` dans `src/mansa/utils/temporaryFreeAccess.ts` ouvre temporairement toutes les offres de l’entreprise aux clients **connectés**, sans achat, facture, commission ni faux entitlement payé. Ce n’est pas un essai individuel de sept jours : il reste actif jusqu’à sa désactivation. Les prix et les données d’achat ne sont pas modifiés.

Pour que le contenu hébergé dans Firebase soit effectivement lisible, les règles Firestore et Storage comportent également un marqueur temporaire. Pendant son activation, tout compte authentifié peut lire le contenu privé des produits et les objets sous `product-assets`. Ne déployez ces règles qu’en sachant que cela rend les ressources cloud de tous les produits accessibles à tous les comptes connectés.

Les produits publics restent soumis à leur état de publication. Ce mode ne crée pas d’enregistrements `paid` et ne déclenche aucun prélèvement.

## Désactivation rapide

1. Dans `src/mansa/utils/temporaryFreeAccess.ts`, passer `TEMPORARY_FREE_ACCESS_ENABLED` à `false`, puis publier la nouvelle version de l’application. L’interface revient alors aux droits habituels et au parcours de paiement.
2. **Restaurer aussi les règles Firebase** : dans `firestore.rules`, retirer `temporaryGlobalFreeAccessEnabled()` et sa branche dans `canReadPrivateProductContent`, afin que cette fonction n’autorise plus que le créateur ou un entitlement valide. Dans `storage.rules`, retirer le helper temporaire et la clause `signedIn() && temporaryGlobalFreeAccessEnabled()` de la règle `product-assets`.
3. Déployer les règles restaurées dans le bon projet Firebase avec `firebase deploy --only firestore:rules,storage`.
4. Vérifier avec un compte authentifié sans entitlement que la fiche publique du produit reste visible, mais que `productPrivateContent` et ses fichiers privés sont refusés. Vérifier aussi qu’un client payé et le créateur gardent leur accès.

Ne pas se contenter de mettre le drapeau TypeScript à `false` : tant que les règles Firebase permissives restent déployées, un client connecté peut encore lire le contenu cloud directement.

## Suppression complète du code temporaire

Après désactivation et déploiement des règles fermées :

- supprimer `src/mansa/utils/temporaryFreeAccess.ts` et ses imports;
- dans `rightsAccessEngine.ts`, retirer l’ajout de toutes les offres dans `normalizeUnlockedOfferIds`;
- dans `dbService.ts`, rétablir le contrôle obligatoire `memberEntitlements.status === "paid"` dans `loadVerifiedMemberContent`;
- dans `EnterpriseMemberView.tsx`, supprimer le message gratuit, la branche « Accéder gratuitement » et revenir au bouton qui ouvre `OfferCheckoutModal`;
- dans `firestore.rules` et `storage.rules`, retirer les helpers/commentaires marqués `TEMPORARY GLOBAL FREE ACCESS`;
- retirer le test spécifique au mode gratuit, puis lancer la suite de tests, le build et `git diff --check`.

Aucun entitlement payé ni achat n’est créé par le mode temporaire; il n’y a donc pas de documents d’achat artificiels à nettoyer.

## Limite des fichiers créateur enregistrés localement

Les fichiers enregistrés par l’espace Fichiers dans IndexedDB restent propres au navigateur/appareil du créateur. Le mode gratuit ne les synchronise pas vers les clients. Seuls les contenus et pièces réellement présents dans Firestore/Firebase Storage peuvent être servis à distance; la disponibilité d’un fichier local nécessite une migration de son stockage vers Firebase Storage.
