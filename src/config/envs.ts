
import 'dotenv/config';
import * as joi from 'joi';



interface EnvVars {
    NATS_URL: string;
}


const envsSchema = joi.object({
    NATS_URL: joi.string().required()
})
.unknown(true);


const{error, value} = envsSchema.validate(process.env);

if(error){
    throw new Error(`Config validation error ${error.message}`)
}

const envVars: EnvVars = value;


export const envs = {
    natsUrl: envVars.NATS_URL
}
