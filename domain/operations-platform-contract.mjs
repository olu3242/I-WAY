export const platformCaseContract=Object.freeze({
 sources:['driver','fleet','carrier','system'],
 categories:['payment','settlement','load','account','compliance','document','technical','dispute','other'],
 transitions:{new:['assigned'],assigned:['in_progress','waiting_user'],in_progress:['waiting_user','resolved'],waiting_user:['in_progress'],resolved:['in_progress','closed'],closed:[]}
});
